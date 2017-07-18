'use strict';
const debug = true;
const proxyURL = '../proxy/proxy.php';
const proxykey = 'ct1718';
const bitkey = 0x2017;
const speechRecogKey = '8d104cd940444fbbaaf3dd3e9881f7cc';
const audioText = ['Show Speech Recognition', 'Hide Speech Recognition'];
const videoText = ['Show Webcam Image', 'Hide Webcam Image'];
const sentiments = ['depressed', 'bad', 'neutral', 'okay', 'euphoric'];
const videoSize = {w: 300, h: 300};
const $ = query => document.querySelectorAll(query);
const textarea = $('textarea')[0];
const video = $('video')[0];
const canvas = $('canvas')[0];
let SDK, recognizer, radioEls, videoStreaming = false;

const speechSetup = () => {
	const userAgent = new SDK.OS(navigator.userAgent, 'Browser', null);
	const device = new SDK.Device('SpeechSample', 'SpeechSample', '1.0.00000');
	const context = new SDK.Context(userAgent, device);
	const config = new SDK.SpeechConfig(context);
	const recognizerConfig = new SDK.RecognizerConfig(
		config,
		recognitionModes.value,
		languageOptions.value,
		SDK.SpeechResultFormat[formatOptions.value],
		profanityOptions.value
	);
	const authentication = new SDK.CognitiveSubscriptionKeyAuthentication((parseInt(speechRecogKey.substr(0, 4), 16) ^ bitkey).toString(16) + speechRecogKey.substr(4));
	recognizer = SDK.CreateRecognizer(recognizerConfig, authentication);
};

const recognizerStart = (SDK, recognizer) => {
	recognizer.Recognize(ev => {
		switch (ev.Name) {
			case 'RecognitionTriggeredEvent' :
				updateStatus('Initializing');
				break;
			case 'ListeningStartedEvent' :
				updateStatus('Listening');
				break;
			case 'RecognitionStartedEvent' :
				updateStatus('Listening_Recognizing');
				break;
			case 'SpeechStartDetectedEvent' :
				updateStatus('Listening_DetectedSpeech_Recognizing');
				if (debug) console.info(ev.Result);
				break;
			case 'SpeechHypothesisEvent' :
				hypothesisEl.innerHTML = 'Current hypothesis: ' + ev.Result.Text;
				if (debug) console.info(ev.Result);
				break;
			case 'SpeechEndDetectedEvent' :
				stopAudioBtn.disabled = true;
				updateStatus('Processing_Adding_Final_Touches');
				if (debug) console.info(ev.Result);
				break;
			case 'SpeechSimplePhraseEvent' :
				updateRecognizedPhrase(ev.Result);
				break;
			case 'SpeechDetailedPhraseEvent' :
				updateRecognizedPhrase(ev.Result);
				break;
			case 'RecognitionEndedEvent' :
				startAudioBtn.disabled = false;
				stopAudioBtn.disabled = true;
				updateStatus('Idle');
				if (debug) console.info(ev);
				break;
		}
	})
	.On(
		() => updateStatus('Request succeeded'),
		error => console.error(error)
	);
}

const recognizerStop = recognizer => recognizer.AudioSource.TurnOff();

const updateStatus = statusVal => {
	statusSpan.innerHTML = statusVal;
	if (debug) console.info(statusVal);
};

const updateRecognizedPhrase = result => {
	if (debug) console.log(JSON.stringify(result, null, 3));
	let output = '<legend>Transcription Result</legend>';
	result.NBest.forEach((el, i) => {
		output += '<label><input type="radio" name="textVariant" value="var' + i + '"><output id="var' + i + '">' + el.Display + '</output> <code>(confidence: ' + el.Confidence + ')</code></label>';
	});
	transcriptionSection.innerHTML = output;
	transcriptionSection.style.display = 'block';
	if (radioEls) {
		for (let i = 0; i < radioEls.length; i++)
			radioEls[i].removeEventListener('change', onSelectionChange, false);
	}
	radioEls = $('input[name=textVariant]');
	for (let i = 0; i < radioEls.length; i++)
		radioEls[i].addEventListener('change', onSelectionChange, false);
	radioEls[0].dispatchEvent(new MouseEvent('click'));
};

const onSelectionChange = ev => {
	ev.preventDefault();
	textarea.value = document.getElementById(ev.target.value).textContent;
};

const onRequestSpellcheck = ev => {
	if (debug) console.info('Spellchecking ...');
	ev.preventDefault();
	const hr = new XMLHttpRequest();
	hr.onreadystatechange = () => {
		if (hr.readyState !== 4) return;
		if (hr.status !== 200) {
			console.error(hr);
			return;
		}
		if (debug) console.info(hr);
		const result = JSON.parse(hr.responseText);
		spellcheckSection.style.display = 'block';
		spellcheckSection.innerHTML = '<legend>Spellcheck Result</legend>';
		if (!result.flaggedTokens.length) {
			spellcheckSection.innerHTML += 'No errors found';
			return;
		}
		let spch = '<ul>';
		result.flaggedTokens.forEach(token => {
			spch += '<li>' + token.token + ' (position ' + token.offset + '): ';
			if (token.type === 'RepeatedToken') {
				spch += 'repeated word';
			} else if (token.suggestions.length) {
				spch += 'did you mean "';
				const suggestions = token.suggestions.map(el => el.suggestion);
				spch += suggestions.join('", "') + '"?';
			} else {
				spch += 'unknown word';
			}
		});
		spch += '</ul>';
		spellcheckSection.innerHTML += spch;
	};
	hr.open('POST', proxyURL + '?proxykey=' + proxykey + '&action=spellcheck&setLang=' + languageOptions.value + '&mode=' + (languageOptions.value === 'en-US'? 'proof' : 'spell'));
	hr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
	hr.send('text=' + encodeURI(textarea.value));
};

const onRequestAnalysis = ev => {
	ev.preventDefault();
	analysisSection.innerHTML = '<legend>Text Analytics</legend>';
	analysisSection.style.display = 'block';
	const analyzeText = (type, lang) => {
		if (debug) console.info('Analyzing text: ' + type + ' ...');
		const hr = new XMLHttpRequest();
		hr.onreadystatechange = () => {
			if (hr.readyState !== 4) return;
			if (hr.status === 200) {
				if (debug) console.info(hr);
				displayAnalysis(JSON.parse(hr.responseText));
			} else {
				console.error(hr);
			}
		};
		const json = {'documents': [{
			'id': 1,
			'language': lang,
			'text': textarea.value
		}]};
		hr.open('POST', proxyURL + '?proxykey=' + proxykey + '&action=textAnalytics&endpoint=' + type);
		hr.setRequestHeader('Content-Type', 'application/json');
		hr.send(JSON.stringify(json));
	};

	const displayAnalysis = function(json) {
		if (debug) console.info(json);
		if (!json.documents.length) {
			analysisSection.innerHTML += '<p><strong>Error</strong>: ' + (json.errors.length? json.errors[0].message : 'Unknown error') + '</p>';
			return;
		}
		let output = [];
		const data = json.documents[0];
		if (data.keyPhrases) {
			output.push('<strong>Keywords</strong>: <em>' + data.keyPhrases.join('</em>, <em>') + '</em>');
		} else if (typeof data.score === 'number') {
			let sentiment;
			for (let i = 0; i < sentiments.length; i++) {
				if ((i + 1) / sentiments.length >= data.score) {
					sentiment = sentiments[i];
					break;
				}
			}
			output.push('<strong>Mood</strong>: ' + sentiment + ' (Score: ' + data.score + ')');
		}
		if (json.errors.length)
			output.push('<strong>Error</strong>: ' + json.errors.join(', '));
		output.forEach(content => {
			analysisSection.innerHTML += '<p>' + content + '</p>';
		});
	};

	['sentiment', 'keyPhrases'].forEach(task => analyzeText(task, languageOptions.value.split('-')[0]));
};

const onEmotion = ev => {
	if (debug) console.info('Detecting photo emotion ...');
	ev.preventDefault();
	const hr = new XMLHttpRequest();
	hr.onreadystatechange = () => {
		if (hr.readyState !== 4) return;
		if (hr.status !== 200) {
			console.error(hr);
			return;
		}
		if (debug) console.info(hr);
		const result = JSON.parse(hr.responseText);
		if (!result.length) {
			updateStatus('Emotion detection returned no results.');
			return;
		}
		emotionSection.style.display = 'block';
		emotionSection.innerHTML = '<legend>Photo Emotion</legend>';
		const emotions = result[0].scores;
		const emotionsSorted = Object.keys(emotions).sort((a, b) => emotions[b] - emotions[a]);
		emotionSection.innerHTML += '<ul>' + emotionsSorted.map(key => '<li><strong>' + key + '</strong>: ' + emotions[key] + '</li>').join('') + '</ul>';
	};
	hr.open('POST', proxyURL + '?proxykey=' + proxykey + '&action=emotion');
	hr.setRequestHeader('Content-Type', 'application/octet-stream');
	fetch(canvas.toDataURL('image/png'))
	.then(res => res.blob())
	.then(blob => hr.send(blob));
};

const savePost = ev => {
	ev.preventDefault();
	if (debug) console.info('Saving Post ...');
	alert('I\'m a dummy. Nothing happening here.')
};

// Toggle Buttons
audioSectionBtn.textContent = audioText[0];
audioSectionBtn.addEventListener('click', ev => {
	ev.preventDefault();
	if (getComputedStyle(audioSection).display === 'block') {
		audioSection.style.display = 'none';
		audioSectionBtn.textContent = audioText[0];
	} else {
		audioSection.style.display = 'block';
		audioSectionBtn.textContent = audioText[1];
	}
});

captureBtn.addEventListener('click', ev => {
	ev.preventDefault();
	if (debug) console.info('Taking photo ...');
	canvas.width = videoSize.w;
	canvas.height = videoSize.h;
	canvas.getContext('2d').drawImage(video, 0, 0, videoSize.w, videoSize.h);
	canvas.style.display = 'inline-block';
	requestEmotionBtn.disabled = false;
});

cameraSectionBtn.textContent = videoText[0];
cameraSectionBtn.addEventListener('click', ev => {
	ev.preventDefault();
	if (cameraSectionBtn.textContent === videoText[1]) {
		cameraSection.style.display = 'none';
		cameraSectionBtn.textContent = videoText[0];
	} else {
		cameraSection.style.display = 'block';
		cameraSectionBtn.textContent = videoText[1];
		if (!videoStreaming) {
			if (debug) console.info('Starting webcam ...');
			navigator.mediaDevices.getUserMedia({video: {width: videoSize.w, height: videoSize.h}})
			.then(stream => {
				video.srcObject = stream;
				videoStreaming = true;
			}, err => console.error(err));
		}
	}
});

startAudioBtn.addEventListener('click', () => {
	if (!recognizer) speechSetup();
	[hypothesisEl, transcriptionSection].forEach(el => el.innerHTML = '');
	[spellcheckSection, analysisSection].forEach(el => {
		el.innerHTML = '';
		el.style.display = 'none';
	});
	currentStateDiv.style.display = 'block';
	startAudioBtn.disabled = true;
	stopAudioBtn.disabled = false;
	recognizerStart(SDK, recognizer);
});

stopAudioBtn.addEventListener('click', () => {
	transcriptionSection.style.display = 'none';
	startAudioBtn.disabled = false;
	stopAudioBtn.disabled = true;
	recognizerStop(recognizer);
});

requestSpellcheckBtn.addEventListener('click', onRequestSpellcheck);
requestAnalysisBtn.addEventListener('click', onRequestAnalysis);
requestEmotionBtn.addEventListener('click', onEmotion);
saveBtn.addEventListener('click', savePost);

// Other Event Handlers
languageOptions.addEventListener('change', () => speechSetup());
formatOptions.addEventListener('change', () => speechSetup());

require(['Speech.Browser.Sdk'], speechSdk => {
	SDK = speechSdk;
	startAudioBtn.disabled = false;
	updateStatus('loaded');
});
