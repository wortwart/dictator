<?php
$debug = false;
$actions = [];
require('./.keys.php');

// Service-specific settings

if (isset($keys['spellcheck'])) {
	$actions['spellcheck'] = [
		'key' => $keys['spellcheck'],
		'method' => 'POST',
		'url' => 'https://api.cognitive.microsoft.com/bing/v5.0/',
		'endpoint' => ['spellcheck'],
		'query' => [
			'mkt' => 'de-DE',
			'setLang' => ['en-GB', 'en-US', 'fr-FR', 'de-DE', 'it-IT', 'es-ES'],
			'mode' => ['proof', 'spell']
		],
		'contenttype' => 'application/x-www-form-urlencoded'
	];
}
if (isset($keys['textAnalytics'])) {
	$actions['textAnalytics'] = [
		'key' => $keys['textAnalytics'],
		'method' => 'POST',
		'url' => 'https://westus.api.cognitive.microsoft.com/text/analytics/v2.0/',
		'endpoint' => ['sentiment', 'keyPhrases'],
		'contenttype' => 'application/json',
		'accepttype' => 'application/json'
	];
}
if (isset($keys['emotion'])) {
	$actions['emotion'] = [
		'key' => $keys['emotion'],
		'method' => 'POST',
		'url' => 'https://westus.api.cognitive.microsoft.com/emotion/v1.0/',
		'endpoint' => ['recognize'],
		'contenttype' => 'application/octet-stream',
	];
}
if (isset($keys['speechRecog'])) {
	$actions['speechRecog'] = [
		'key' => $keys['speechRecog']
	];
}

if (count($actions) === 0) err(__LINE__);

// HTTP header names
$headerMap = [
	'key' => 'Ocp-Apim-Subscription-Key',
	'contenttype' => 'Content-Type',
	'accepttype' => 'Accept-Type'
];

// Check request validity
if (!isset($_SERVER['HTTP_REFERER'])) err(__LINE__);
$regex = '/^https?:\/\/' . $_SERVER['HTTP_HOST'] . '\//i';
if (!preg_match($regex, $_SERVER['HTTP_REFERER'])) err(__LINE__);

$body = file_get_contents('php://input');
// Check necessary GET parameters
if (!count($_GET)) err(__LINE__);
if (isset($proxykey)) {
	if (!isset($_GET['proxykey'])) err(__LINE__);
	if ($_GET['proxykey'] !== $proxykey) err(__LINE__);
}
if (!isset($_GET['action'])) err(__LINE__);
if (!array_key_exists($_GET['action'], $actions)) err(__LINE__);
$settings = $actions[$_GET['action']];
if (!isset($settings['key'])) err();
$params = [];
foreach($settings as $setting => $settingvals) {
	if (!is_array($settingvals)) {	// scalar value, no choice
		$params[$setting] = $settingvals;
		continue;
	}
	if ($setting === 'query') {	// special case: query params
		$query = [];
		foreach ($settingvals as $qfield => $qvals) {
			if (!is_array($qvals)) {
				$query[$qfield] = $qvals;
				continue;
			}
			if (!isset($_GET[$qfield])) err(__LINE__);
			if (!in_array($_GET[$qfield], $qvals)) err(__LINE__);
			$query[$qfield] = $_GET[$qfield];
		}
		$params['query'] = $query;
		continue;
	}
	if (!isset($_GET[$setting])) {	// array of values to choose from
		$params[$setting] = $settingvals[0];
	} else {
		if (!in_array($_GET[$setting], $settingvals)) err(__LINE__);
		$params[$setting] = $_GET[$setting];
	}
}

// Special case: return key (slightly encrypted)
if ($_GET['action'] === 'speechRecog') {
	$enc = dechex(intval(substr($settings['key'], 0, 4), 16) ^ $bitkey);
	echo $enc . substr($settings['key'], 4);
	exit;
}

// Request is legitimate: Prepare forwarding
$url = $params['url'] . $params['endpoint'];
if (isset($params['query'])) {
	$qparams = [];
	foreach($params['query'] as $key => $val) {
		$qparams[] = $key . '=' . $val;
	}
	$url .= '?' . join($qparams, '&');
}
$headers = [];
foreach ($headerMap as $htype => $hval) {
	if (!isset($params[$htype])) continue;
	$headers[] = $hval . ': ' . $params[$htype];
}

// Forward request to target server
$curl_handle = curl_init();
curl_setopt($curl_handle, CURLOPT_POST, 1);
curl_setopt($curl_handle, CURLOPT_URL, $url);
curl_setopt($curl_handle, CURLOPT_HTTPHEADER, $headers);
curl_setopt($curl_handle, CURLOPT_RETURNTRANSFER, true);
curl_setopt($curl_handle, CURLOPT_POSTFIELDS, $body);
if ($debug) curl_setopt($curl_handle, CURLOPT_SSL_VERIFYPEER, false);
$response = curl_exec($curl_handle);
curl_close($curl_handle);
echo $response;

function err($line) {
	global $debug;
	if ($debug) {
		error_reporting(E_ALL);
		die('Error: line ' . $line);
	}
	// Fake 404 error
	http_response_code(404);
	die();
}

?>