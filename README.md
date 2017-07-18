# dictator
Speech recognition, text analysis and emotion detection using Azure Cognitive Services

This JavaScript-based demo webapp for an article in [c't Magazin 18/2017](http://ct.de/) enables you to transcribe spoken text, fix spelling errors, detect keywords, analyze the emotion of the text and the expression of your face. It uses several Cognitive Services of [Microsoft Azure](https://docs.microsoft.com/de-de/azure/cognitive-services/):

- Bing Speech API
- Bing Spellcheck API
- Text Analytics API
- Emotion API

The app comes in two flavours: `without-proxy` includes the keys in the source code, `with-proxy` passes requests to 3 of the 4 APIs through a simple PHP proxy which is in the `proxy` directory. The speech recognition key is used with WebSockets and is only minimally protected by some bit moving mojo. Both flavours of the app are functionally identical.

Live Demo: [woerter.de](https://woerter.de/projects/cognitive-services/dictator/). The live demo does not contain the spellchecker and has limited API quota.

See also: [Acting Game](https://github.com/wortwart/acting-game).
