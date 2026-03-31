<?php
/**
 * URL Shortening Proxy
 * Bypasses CORS restrictions by making server-side requests to URL shortening services
 */

// Enable CORS for your domain
$allowedOrigins = ['https://stefanomorello.com', 'http://localhost:8765', 'http://127.0.0.1:8765'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    header('Access-Control-Allow-Origin: https://stefanomorello.com');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Use POST.']);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);
$longURL = $input['url'] ?? null;

if (!$longURL) {
    http_response_code(400);
    echo json_encode(['error' => 'No URL provided']);
    exit();
}

// Validate URL
if (!filter_var($longURL, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid URL format']);
    exit();
}

// Restrict to http/https schemes only
$parsedURL = parse_url($longURL);
if (!in_array($parsedURL['scheme'] ?? '', ['http', 'https'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Only http and https URLs are allowed']);
    exit();
}

// Block requests to private/internal networks
$host = $parsedURL['host'] ?? '';
$ip = gethostbyname($host);
if ($ip !== $host) {
    $privateRanges = ['10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.', '127.', '169.254.', '0.'];
    foreach ($privateRanges as $range) {
        if (strpos($ip, $range) === 0) {
            http_response_code(400);
            echo json_encode(['error' => 'URLs pointing to private networks are not allowed']);
            exit();
        }
    }
}

/**
 * Try multiple URL shortening services in order
 * Using modern, actively maintained APIs (NO DEPRECATED APIS)
 *
 * Services selected for 2025:
 * - TinyURL: Most reliable, no rate limits for reasonable use
 * - is.gd: Fast, reliable
 * - v.gd: Sister service to is.gd
 * - Clck.ru: Russian service, simple GET API
 * - dagd: Final fallback
 */
$services = [
    [
        'name' => 'TinyURL',
        'url' => 'https://tinyurl.com/api-create.php?url=' . urlencode($longURL),
        'method' => 'GET',
        'parse' => function($response) {
            $shortURL = trim($response);
            if (filter_var($shortURL, FILTER_VALIDATE_URL) && strpos($shortURL, 'tinyurl.com') !== false) {
                return $shortURL;
            }
            return null;
        }
    ],
    [
        'name' => 'is.gd',
        'url' => 'https://is.gd/create.php?format=simple&url=' . urlencode($longURL),
        'method' => 'GET',
        'parse' => function($response) {
            $shortURL = trim($response);
            if (filter_var($shortURL, FILTER_VALIDATE_URL)) {
                return $shortURL;
            }
            return null;
        }
    ],
    [
        'name' => 'v.gd',
        'url' => 'https://v.gd/create.php?format=simple&url=' . urlencode($longURL),
        'method' => 'GET',
        'parse' => function($response) {
            $shortURL = trim($response);
            if (filter_var($shortURL, FILTER_VALIDATE_URL)) {
                return $shortURL;
            }
            return null;
        }
    ],
    [
        'name' => 'Clck.ru',
        'url' => 'https://clck.ru/--?url=' . urlencode($longURL),
        'method' => 'GET',
        'parse' => function($response) {
            $shortURL = trim($response);
            if (filter_var($shortURL, FILTER_VALIDATE_URL) && strpos($shortURL, 'clck.ru') !== false) {
                return $shortURL;
            }
            return null;
        }
    ],
    [
        'name' => 'dagd',
        'url' => 'https://da.gd/s?url=' . urlencode($longURL),
        'method' => 'GET',
        'parse' => function($response) {
            $lines = explode("\n", trim($response));
            $shortURL = trim($lines[0]);
            if (filter_var($shortURL, FILTER_VALIDATE_URL)) {
                return $shortURL;
            }
            return null;
        }
    ]
];

$errors = [];

// Try each service
foreach ($services as $service) {
    try {
        // Use cURL for better control
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $service['url']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Handle POST requests
        if ($service['method'] === 'POST' && isset($service['postData'])) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $service['postData']);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            $errors[] = "{$service['name']}: cURL error - {$curlError}";
            continue;
        }

        if ($httpCode !== 200) {
            $errors[] = "{$service['name']}: HTTP {$httpCode}";
            continue;
        }

        // Parse the response
        $shortURL = $service['parse']($response);

        if ($shortURL) {
            // Success!
            echo json_encode([
                'success' => true,
                'shorturl' => $shortURL,
                'service' => $service['name'],
                'original_length' => strlen($longURL),
                'shortened_length' => strlen($shortURL)
            ]);
            exit();
        } else {
            $errors[] = "{$service['name']}: Invalid response format";
        }

    } catch (Exception $e) {
        $errors[] = "{$service['name']}: {$e->getMessage()}";
    }
}

// All services failed
http_response_code(503);
echo json_encode([
    'success' => false,
    'error' => 'All URL shortening services failed',
    'details' => $errors,
    'fallback' => 'Use the long URL directly'
]);
?>
