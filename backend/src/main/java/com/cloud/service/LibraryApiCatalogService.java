package com.cloud.service;

import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class LibraryApiCatalogService {

    private static final List<String> SUPPORTED_LIBRARIES = List.of("hwplib", "hwpxlib", "poi");

    private static final Map<String, List<RequiredMethodSpec>> REQUIRED_METHODS = Map.of(
            "hwplib", List.of(
                    new RequiredMethodSpec("kr.dogfoot.hwplib.reader.HWPReader", "fromFile"),
                    new RequiredMethodSpec("kr.dogfoot.hwplib.writer.HWPWriter", "toBytes"),
                    new RequiredMethodSpec("kr.dogfoot.hwplib.object.bodytext.control.ControlType", "getCtrlId"),
                    new RequiredMethodSpec("kr.dogfoot.hwplib.object.docinfo.borderfill.fillinfo.FillInfo", "getType")
            ),
            "hwpxlib", List.of(
                    new RequiredMethodSpec("kr.dogfoot.hwpxlib.reader.HWPXReader", "fromFile"),
                    new RequiredMethodSpec("kr.dogfoot.hwpxlib.writer.HWPXWriter", "toBytes"),
                    new RequiredMethodSpec("kr.dogfoot.hwpxlib.tool.blankfilemaker.BlankFileMaker", "make")
            ),
            "poi", List.of(
                    new RequiredMethodSpec("org.apache.poi.xwpf.usermodel.XWPFDocument", "getParagraphs"),
                    new RequiredMethodSpec("org.apache.poi.xssf.usermodel.XSSFWorkbook", "getNumberOfSheets"),
                    new RequiredMethodSpec("org.apache.poi.xslf.usermodel.XMLSlideShow", "getSlides")
            )
    );

    private static final Map<String, String> LIBRARY_PREFIX = Map.of(
            "hwplib", "kr/dogfoot/hwplib/",
            "hwpxlib", "kr/dogfoot/hwpxlib/",
            "poi", "org/apache/poi/"
    );

    private final AtomicReference<CatalogSnapshot> snapshotRef = new AtomicReference<>();

    public Map<String, Object> getCatalog(String library, String keyword, boolean includeMethods, int maxMatches) {
        String normalizedLibrary = normalizeLibrary(library);
        String normalizedKeyword = normalizeKeyword(keyword);
        int safeMaxMatches = Math.max(1, Math.min(maxMatches, 300));

        CatalogSnapshot snapshot = ensureSnapshot();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("generatedAt", snapshot.generatedAt().toString());
        result.put("libraries", summarizeLibraries(snapshot, normalizedLibrary));
        result.put("requiredApiValidation", buildRequiredValidation(snapshot, normalizedLibrary));

        if (normalizedKeyword != null) {
            result.put("matches", findMatches(snapshot, normalizedLibrary, normalizedKeyword, includeMethods, safeMaxMatches));
        }

        return result;
    }

    public Map<String, Object> refreshCatalog(String library, String keyword, boolean includeMethods, int maxMatches) {
        snapshotRef.set(buildSnapshot());
        return getCatalog(library, keyword, includeMethods, maxMatches);
    }

    private CatalogSnapshot ensureSnapshot() {
        CatalogSnapshot existing = snapshotRef.get();
        if (existing != null) {
            return existing;
        }
        CatalogSnapshot created = buildSnapshot();
        snapshotRef.compareAndSet(null, created);
        return snapshotRef.get();
    }

    private CatalogSnapshot buildSnapshot() {
        Map<String, Map<String, Set<String>>> libraryClassMethods = new LinkedHashMap<>();
        for (String lib : SUPPORTED_LIBRARIES) {
            libraryClassMethods.put(lib, new LinkedHashMap<>());
        }

        for (Path cpEntry : classPathEntries()) {
            if (Files.isDirectory(cpEntry)) {
                scanDirectoryEntry(cpEntry, libraryClassMethods);
            } else {
                String lower = cpEntry.getFileName().toString().toLowerCase(Locale.ROOT);
                if (lower.endsWith(".jar")) {
                    scanJarEntry(cpEntry, libraryClassMethods);
                }
            }
        }

        Map<String, Map<String, List<String>>> frozen = new LinkedHashMap<>();
        for (Map.Entry<String, Map<String, Set<String>>> libEntry : libraryClassMethods.entrySet()) {
            Map<String, List<String>> classes = new LinkedHashMap<>();
            List<String> sortedClasses = new ArrayList<>(libEntry.getValue().keySet());
            sortedClasses.sort(String::compareTo);
            for (String className : sortedClasses) {
                List<String> methods = new ArrayList<>(libEntry.getValue().getOrDefault(className, Collections.emptySet()));
                methods.sort(String::compareTo);
                classes.put(className, methods);
            }
            frozen.put(libEntry.getKey(), classes);
        }

        return new CatalogSnapshot(Instant.now(), frozen);
    }

    private List<Path> classPathEntries() {
        String cp = System.getProperty("java.class.path", "");
        if (cp.isBlank()) {
            return List.of();
        }
        return Arrays.stream(cp.split(File.pathSeparator))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Paths::get)
                .collect(Collectors.toList());
    }

    private void scanDirectoryEntry(Path root, Map<String, Map<String, Set<String>>> libraryClassMethods) {
        try (Stream<Path> walk = Files.walk(root)) {
            walk.filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().endsWith(".class"))
                    .forEach(path -> {
                        String relative = root.relativize(path).toString().replace('\\', '/');
                        processClassResource(relative, libraryClassMethods);
                    });
        } catch (IOException ignored) {
        }
    }

    private void scanJarEntry(Path jarPath, Map<String, Map<String, Set<String>>> libraryClassMethods) {
        try (JarFile jar = new JarFile(jarPath.toFile())) {
            jar.stream()
                    .map(JarEntry::getName)
                    .filter(name -> name.endsWith(".class"))
                    .forEach(name -> processClassResource(name, libraryClassMethods));
        } catch (IOException ignored) {
        }
    }

    private void processClassResource(String classResource, Map<String, Map<String, Set<String>>> libraryClassMethods) {
        String normalizedResource = classResource.replace('\\', '/');
        if (normalizedResource.contains("$")) {
            return;
        }

        String matchedLibrary = null;
        for (String library : SUPPORTED_LIBRARIES) {
            String prefix = LIBRARY_PREFIX.get(library);
            if (normalizedResource.startsWith(prefix)) {
                matchedLibrary = library;
                break;
            }
        }

        if (matchedLibrary == null) {
            return;
        }

        String className = normalizedResource
                .substring(0, normalizedResource.length() - ".class".length())
                .replace('/', '.');

        extractMethods(matchedLibrary, className, libraryClassMethods);
    }

    private void extractMethods(String library, String className, Map<String, Map<String, Set<String>>> libraryClassMethods) {
        try {
            Class<?> clazz = Class.forName(className, false, Thread.currentThread().getContextClassLoader());
            Method[] declared = clazz.getDeclaredMethods();
            if (declared.length == 0) {
                libraryClassMethods.get(library).putIfAbsent(className, new LinkedHashSet<>());
                return;
            }

            Set<String> methodNames = libraryClassMethods.get(library)
                    .computeIfAbsent(className, key -> new LinkedHashSet<>());

            for (Method method : declared) {
                if (Modifier.isPublic(method.getModifiers())) {
                    methodNames.add(method.getName());
                }
            }
        } catch (Throwable ignored) {
        }
    }

    private List<Map<String, Object>> summarizeLibraries(CatalogSnapshot snapshot, String library) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (String lib : selectedLibraries(library)) {
            Map<String, List<String>> classes = snapshot.libraryClassMethods().getOrDefault(lib, Collections.emptyMap());
            int methodCount = classes.values().stream().mapToInt(List::size).sum();
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("library", lib);
            item.put("classCount", classes.size());
            item.put("methodCount", methodCount);
            list.add(item);
        }
        return list;
    }

    private List<Map<String, Object>> buildRequiredValidation(CatalogSnapshot snapshot, String library) {
        List<Map<String, Object>> output = new ArrayList<>();
        for (String lib : selectedLibraries(library)) {
            Map<String, List<String>> classes = snapshot.libraryClassMethods().getOrDefault(lib, Collections.emptyMap());
            List<RequiredMethodSpec> specs = REQUIRED_METHODS.getOrDefault(lib, List.of());

            for (RequiredMethodSpec spec : specs) {
                List<String> methods = classes.getOrDefault(spec.className(), List.of());
                boolean exists = methods.contains(spec.methodName());
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("library", lib);
                row.put("className", spec.className());
                row.put("methodName", spec.methodName());
                row.put("exists", exists);
                output.add(row);
            }
        }
        return output;
    }

    private List<Map<String, Object>> findMatches(
            CatalogSnapshot snapshot,
            String library,
            String keyword,
            boolean includeMethods,
            int maxMatches
    ) {
        List<Map<String, Object>> matches = new ArrayList<>();

        for (String lib : selectedLibraries(library)) {
            Map<String, List<String>> classes = snapshot.libraryClassMethods().getOrDefault(lib, Collections.emptyMap());
            for (Map.Entry<String, List<String>> entry : classes.entrySet()) {
                String className = entry.getKey();
                List<String> methods = entry.getValue();

                boolean classMatched = className.toLowerCase(Locale.ROOT).contains(keyword);
                List<String> methodMatched = methods.stream()
                        .filter(m -> m.toLowerCase(Locale.ROOT).contains(keyword))
                        .collect(Collectors.toList());

                if (!classMatched && methodMatched.isEmpty()) {
                    continue;
                }

                Map<String, Object> row = new LinkedHashMap<>();
                row.put("library", lib);
                row.put("className", className);
                row.put("matchedMethodCount", methodMatched.size());
                if (includeMethods) {
                    row.put("methods", classMatched ? methods : methodMatched);
                }
                matches.add(row);
            }
        }

        matches.sort(
                Comparator.comparing((Map<String, Object> m) -> String.valueOf(m.get("library")))
                        .thenComparing(m -> String.valueOf(m.get("className")))
        );

        if (matches.size() > maxMatches) {
            return new ArrayList<>(matches.subList(0, maxMatches));
        }
        return matches;
    }

    private List<String> selectedLibraries(String library) {
        if (library != null) {
            return List.of(library);
        }
        return SUPPORTED_LIBRARIES;
    }

    private String normalizeLibrary(String library) {
        if (library == null || library.isBlank()) {
            return null;
        }
        String normalized = library.trim().toLowerCase(Locale.ROOT);
        if (!SUPPORTED_LIBRARIES.contains(normalized)) {
            throw new IllegalArgumentException("Unsupported library: " + library);
        }
        return normalized;
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        return keyword.trim().toLowerCase(Locale.ROOT);
    }

    private record CatalogSnapshot(Instant generatedAt, Map<String, Map<String, List<String>>> libraryClassMethods) {
    }

    private record RequiredMethodSpec(String className, String methodName) {
    }
}
