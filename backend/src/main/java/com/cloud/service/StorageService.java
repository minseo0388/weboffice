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
import java.util.List;
import java.util.stream.Collectors;

/**
 * Handles all Oracle OCI Object Storage operations.
 * Each user has a virtual directory prefix: "users/{provider}_{userId}/"
 * Users can ONLY operate within their own prefix — enforced here, not in HTTP layer.
 */
@Service
public class StorageService {

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
     * Uploads a file to the user's personal directory.
     * Overwrites silently if the file already exists.
     */
    public void uploadFile(UserPrincipal user, String fileName, MultipartFile file) throws Exception {
        String objectName = user.storagePrefixKey() + sanitizeFileName(fileName);

        PutObjectRequest request = PutObjectRequest.builder()
                .namespaceName(namespace)
                .bucketName(bucket)
                .objectName(objectName)
                .contentLength(file.getSize())
                .contentType(file.getContentType())
                .putObjectBody(file.getInputStream())
                .build();

        client.putObject(request);
    }

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
