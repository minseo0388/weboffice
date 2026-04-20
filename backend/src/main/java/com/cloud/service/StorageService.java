package com.cloud.service;

import com.cloud.model.UserPrincipal;
import com.oracle.bmc.Region;
import com.oracle.bmc.auth.ConfigFileAuthenticationDetailsProvider;
import com.oracle.bmc.objectstorage.ObjectStorage;
import com.oracle.bmc.objectstorage.ObjectStorageClient;
import com.oracle.bmc.objectstorage.requests.*;
import com.oracle.bmc.objectstorage.responses.*;
import com.oracle.bmc.objectstorage.model.*;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Handles all Oracle OCI Object Storage operations.
 * Each user has a virtual directory prefix: "users/{provider}_{userId}/"
 * Users can ONLY operate within their own prefix — enforced here, not in HTTP layer.
 */
@Service
public class StorageService {

    private final DocumentServiceFactory documentServiceFactory;

    public StorageService(DocumentServiceFactory documentServiceFactory) {
        this.documentServiceFactory = documentServiceFactory;
    }

    @Value("${oracle.cloud.namespace}")
    private String namespace;

    @Value("${oracle.cloud.bucket}")
    private String bucket;

    private ObjectStorage client;

    @PostConstruct
    public void init() {
        try {
            // Reads ~/.oci/config on the Oracle Cloud instance
            ConfigFileAuthenticationDetailsProvider provider =
                    new ConfigFileAuthenticationDetailsProvider("~/.oci/config", "DEFAULT");
            client = ObjectStorageClient.builder()
                    .region(Region.AP_SEOUL_1) // Change to your OCI region
                    .build(provider);
            System.out.println("OCI Object Storage client initialized.");
        } catch (Exception e) {
            System.err.println("WARNING: Could not initialize OCI client. Storage features will fail. " + e.getMessage());
            // Proceed without crashing context
        }
    }

    /**
     * Lists all files belonging to the given user.
     */
    public List<String> listUserFiles(UserPrincipal user) {
        String prefix = user.storagePrefixKey();

        ListObjectsRequest request = ListObjectsRequest.builder()
                .namespaceName(namespace)
                .bucketName(bucket)
                .prefix(prefix)
                .build();

        ListObjectsResponse response = client.listObjects(request);

        return response.getListObjects().getObjects().stream()
                .map(ObjectSummary::getName)
                .map(name -> name.substring(prefix.length()))
                .filter(name -> !name.isEmpty())
                .collect(Collectors.toList());
    }

    /**
     * Returns the actual storage usage for a user by iterating all their objects
     * and summing the "size" field from OCI Object Storage.
     * Handles OCI pagination via nextStartWith token.
     */
    public StorageStats getUsageStats(UserPrincipal user) {
        String prefix = user.storagePrefixKey();
        long totalBytes = 0;
        int fileCount = 0;
        String nextStart = null;

        do {
            ListObjectsRequest.Builder reqBuilder = ListObjectsRequest.builder()
                    .namespaceName(namespace)
                    .bucketName(bucket)
                    .prefix(prefix)
                    .fields("size")   // Requests byte-size per object from OCI
                    .limit(100);      // OCI max page size

            if (nextStart != null) {
                reqBuilder.start(nextStart);
            }

            ListObjectsResponse response = client.listObjects(reqBuilder.build());

            for (ObjectSummary obj : response.getListObjects().getObjects()) {
                // Skip the virtual "directory" placeholder objects
                String relativeName = obj.getName().substring(prefix.length());
                if (relativeName.isEmpty()) continue;

                if (obj.getSize() != null) {
                    totalBytes += obj.getSize();
                }
                fileCount++;
            }

            nextStart = response.getListObjects().getNextStartWith();
        } while (nextStart != null);

        return new StorageStats(totalBytes, fileCount);
    }

    /**
     * Immutable record representing a user's storage usage snapshot.
     */
    public record StorageStats(long usedBytes, int fileCount) {}

    /**
     * Uploads a file to the user's personal directory from a MultipartFile.
     * Overwrites silently if the file already exists.
     */
    public void uploadFile(UserPrincipal user, String fileName, MultipartFile file) throws Exception {
        String objectName = user.storagePrefixKey() + sanitizeFileName(fileName);
        String contentType = file.getContentType();
        if (contentType == null || contentType.isBlank() || "application/octet-stream".equals(contentType)) {
            contentType = inferContentType(fileName);
        }

        PutObjectRequest request = PutObjectRequest.builder()
                .namespaceName(namespace)
                .bucketName(bucket)
                .objectName(objectName)
                .contentLength(file.getSize())
                .contentType(contentType)
                .putObjectBody(file.getInputStream())
                .build();

        client.putObject(request);
    }

    /**
     * Uploads a file to the user's personal directory from a byte array.
     * Overwrites silently if the file already exists.
     * Infers content type from file extension.
     */
    public void uploadFile(UserPrincipal user, String fileName, byte[] data) throws Exception {
        String objectName = user.storagePrefixKey() + sanitizeFileName(fileName);
        String contentType = inferContentType(fileName);

        ByteArrayInputStream inputStream = new ByteArrayInputStream(data);

        PutObjectRequest request = PutObjectRequest.builder()
                .namespaceName(namespace)
                .bucketName(bucket)
                .objectName(objectName)
                .contentLength((long) data.length)
                .contentType(contentType)
                .putObjectBody(inputStream)
                .build();

        client.putObject(request);
    }

    /**
     * Infers content type based on file extension.
     */
    private String inferContentType(String fileName) {
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".hwp")) return "application/x-hwp";
        if (lower.endsWith(".hwpx")) return "application/x-hwpx";
        if (lower.endsWith(".doc")) return "application/msword";
        if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
        if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        return "application/octet-stream";
    }

    /**
     * Saves edited JSON content back to its original binary Office format.
     * This method handles Microsoft Office formats through DocumentServiceFactory.
     */
    public SaveResult saveEditorContent(UserPrincipal user, String fileName, Map<String, Object> documentModel) throws Exception {
        String format = documentServiceFactory.resolveFormat(fileName);
        if (!documentServiceFactory.isMicrosoftFormat(format)) {
            throw new UnsupportedOperationException("saveEditorContent supports only Microsoft formats: " + format);
        }

        byte[] originalBytes;
        try (InputStream stream = downloadFile(user, fileName)) {
            originalBytes = stream.readAllBytes();
        }

        byte[] updatedBytes = documentServiceFactory.saveDocument(fileName, documentModel, originalBytes);
        uploadFile(user, fileName, updatedBytes);
        return new SaveResult(fileName, format, updatedBytes.length);
    }

    public record SaveResult(String fileName, String fileType, long savedBytes) {}

    /**
     * Downloads a file from the user's personal directory.
     * Returns the raw InputStream for streaming to the client.
     */
    public InputStream downloadFile(UserPrincipal user, String fileName) {
        String objectName = user.storagePrefixKey() + sanitizeFileName(fileName);

        GetObjectRequest request = GetObjectRequest.builder()
                .namespaceName(namespace)
                .bucketName(bucket)
                .objectName(objectName)
                .build();

        GetObjectResponse response = client.getObject(request);
        return response.getInputStream();
    }

    /**
     * Deletes a file from the user's personal directory.
     */
    public void deleteFile(UserPrincipal user, String fileName) {
        String objectName = user.storagePrefixKey() + sanitizeFileName(fileName);

        DeleteObjectRequest request = DeleteObjectRequest.builder()
                .namespaceName(namespace)
                .bucketName(bucket)
                .objectName(objectName)
                .build();

        client.deleteObject(request);
    }

    /**
     * Prevents directory traversal attacks (e.g., "../../etc/passwd").
     */
    private String sanitizeFileName(String fileName) {
        // Strip any path separators — only the final filename is accepted
        return fileName.replaceAll("[/\\\\]", "_");
    }
}
