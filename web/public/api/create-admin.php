<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Méthode non autorisée.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';
$firstName = trim($input['first_name'] ?? '');
$lastName = trim($input['last_name'] ?? '');

if ($email === '' || $password === '' || $firstName === '' || $lastName === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Champs requis manquants.']);
    exit;
}

$supabaseUrl = getenv('SUPABASE_URL') ?: 'https://gxweofraymbcwqxbcsln.supabase.co';
$serviceRoleKey = getenv('SUPABASE_SERVICE_ROLE_KEY') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4d2VvZnJheW1iY3dxeGJjc2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMzA5NjQsImV4cCI6MjA4NTcwNjk2NH0.7bNRXmW0mcnvGT9DhowlzvM3EpWZ_cX-sX2MQc_Z3hk';

if ($supabaseUrl === '' || $serviceRoleKey === '') {
    http_response_code(500);
    echo json_encode(['error' => 'Configuration serveur manquante.']);
    exit;
}

$authHeader = '';
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
} else if (function_exists('apache_request_headers')) {
    $headers = apache_request_headers();
    $authHeader = $headers['Authorization'] ?? '';
}

if (!preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode(['error' => 'Token manquant.']);
    exit;
}

$accessToken = $matches[1];

function supabase_request($method, $url, $headers, $body = null) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$status, $response];
}

// 1) Validate caller token
$authUrl = $supabaseUrl . '/auth/v1/user';
[$authStatus, $authResponse] = supabase_request(
    'GET',
    $authUrl,
    [
        'Authorization: Bearer ' . $accessToken,
        'apikey: ' . $serviceRoleKey
    ]
);

if ($authStatus !== 200) {
    http_response_code(401);
    echo json_encode(['error' => 'Token invalide.']);
    exit;
}

$authData = json_decode($authResponse, true);
$callerId = $authData['id'] ?? '';
if ($callerId === '') {
    http_response_code(401);
    echo json_encode(['error' => 'Utilisateur non valide.']);
    exit;
}

// 2) Check caller is admin
$adminCheckUrl = $supabaseUrl . '/rest/v1/users?select=id&auth_user_id=eq.' . urlencode($callerId) . '&role=eq.admin&is_active=eq.true&limit=1';
[$adminStatus, $adminResponse] = supabase_request(
    'GET',
    $adminCheckUrl,
    [
        'apikey: ' . $serviceRoleKey,
        'Authorization: Bearer ' . $serviceRoleKey
    ]
);

if ($adminStatus !== 200 || empty(json_decode($adminResponse, true))) {
    http_response_code(403);
    echo json_encode(['error' => 'Accès refusé.']);
    exit;
}

// 3) Check email not already used in public.users
$emailCheckUrl = $supabaseUrl . '/rest/v1/users?select=id&email=eq.' . urlencode($email) . '&limit=1';
[$emailStatus, $emailResponse] = supabase_request(
    'GET',
    $emailCheckUrl,
    [
        'apikey: ' . $serviceRoleKey,
        'Authorization: Bearer ' . $serviceRoleKey
    ]
);

if ($emailStatus === 200 && !empty(json_decode($emailResponse, true))) {
    http_response_code(409);
    echo json_encode(['error' => 'Email déjà utilisé.']);
    exit;
}

// 4) Create Auth user
$createAuthUrl = $supabaseUrl . '/auth/v1/admin/users';
$payload = json_encode([
    'email' => $email,
    'password' => $password,
    'email_confirm' => true
]);

[$createStatus, $createResponse] = supabase_request(
    'POST',
    $createAuthUrl,
    [
        'Content-Type: application/json',
        'apikey: ' . $serviceRoleKey,
        'Authorization: Bearer ' . $serviceRoleKey
    ],
    $payload
);

if ($createStatus !== 200 && $createStatus !== 201) {
    http_response_code(500);
    echo json_encode(['error' => 'Création Auth échouée.']);
    exit;
}

$createdUser = json_decode($createResponse, true);
$newAuthId = $createdUser['id'] ?? '';
if ($newAuthId === '') {
    http_response_code(500);
    echo json_encode(['error' => 'Auth user invalide.']);
    exit;
}

// 5) Insert public.users row
$insertUrl = $supabaseUrl . '/rest/v1/users';
$insertPayload = json_encode([
    'auth_user_id' => $newAuthId,
    'first_name' => $firstName,
    'last_name' => $lastName,
    'email' => $email,
    'role' => 'admin',
    'is_active' => true
]);

[$insertStatus, $insertResponse] = supabase_request(
    'POST',
    $insertUrl,
    [
        'Content-Type: application/json',
        'apikey: ' . $serviceRoleKey,
        'Authorization: Bearer ' . $serviceRoleKey,
        'Prefer: return=representation'
    ],
    $insertPayload
);

if ($insertStatus !== 201) {
    $deleteUrl = $supabaseUrl . '/auth/v1/admin/users/' . urlencode($newAuthId);
    supabase_request(
        'DELETE',
        $deleteUrl,
        [
            'apikey: ' . $serviceRoleKey,
            'Authorization: Bearer ' . $serviceRoleKey
        ]
    );
    http_response_code(500);
    echo json_encode(['error' => 'Insertion utilisateur échouée.']);
    exit;
}

echo json_encode(['success' => true]);
