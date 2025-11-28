<?php
/**
 * Content Retrieval API
 * Returns stored game content by ID
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$CONTENT_DIR = __DIR__ . '/content/';

// Get and validate ID
$id = $_GET['id'] ?? null;

if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'No ID provided']);
    exit();
}

// Validate ID format (alphanumeric, 6-12 chars)
if (!preg_match('/^[a-zA-Z0-9]{6,12}$/', $id)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid ID format']);
    exit();
}

$filename = $CONTENT_DIR . $id . '.json';

// Check if file exists
if (!file_exists($filename)) {
    http_response_code(404);
    echo json_encode(['error' => 'Content not found or has expired']);
    exit();
}

// Read content
$content = json_decode(file_get_contents($filename), true);

if (!$content) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to read content']);
    exit();
}

// Check expiration
if (isset($content['_meta']['expires'])) {
    $expiresTime = strtotime($content['_meta']['expires']);
    if ($expiresTime && $expiresTime < time()) {
        // Content has expired - delete and return 404
        unlink($filename);
        http_response_code(404);
        echo json_encode(['error' => 'Content has expired']);
        exit();
    }
}

// Remove metadata before returning to client
unset($content['_meta']);

echo json_encode($content, JSON_UNESCAPED_UNICODE);
?>
