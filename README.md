
Introduction
------------
This is a WEB MIDI application, written in HTML5 and Javascript, that gives a single performer control over the performance of a music score displayed in a browser.<br /><br />
The project is only being tested on the latest versions of Chrome and Firefox, and is not guaranteed to work in other browsers. It uses MIDI input and output devices, and scores stored in an SVG format which has been enhanced to contain MIDI information. Access to the user's MIDI input and output devices is achieved as follows:<br />
In <b>Chrome</b>, activate the Web-MIDI-API flag in chrome://flags.<br />
In <b>Firefox</b>, install the  [Jazz plugin](http://jazz-soft.net). Firefox does not implement the [Web MIDI API](http://webaudio.github.io/web-audio-api/) natively, but will use Chris Wilson's [Web MIDI API Polyfill](https://github.com/cwilso/WebMIDIAPIShim), which in turn uses the plugin. The file _WebMIDIAPI.js_ is a local copy of the latest version of the polyfill.<br />
<br />
This repository has two branches:<br />
1. The <b>master branch</b>. The head of this branch is (or was) a stable, working version of the program. This is the unchanging core of the code kept in the following repository:<br />
https://github.com/notator/assistant-performer-milestones. This, possibly rather old, version can be tried out at<br />
http://james-ingram-act-two.de/open-source/masterAssistantPerformer/assistantPerformer.html<br />
The reason for having a separate repository for the latest milestone version is that the Assistant Performer lives in a volatile environment. Chrome, the WebMIDIAPIShim, the Jazz plug-in, Firefox and my website's structure are all liable to change, and those changes need to be taken on board if the milestone version is to continue working. Changes made in the milestones repository never affect the core Assistant Performer code, just the way it interacts with its environment.
The head of the master branch (the core of the milestones repository) is currently at the state the program was in in March 2014.
<br />
2. The <b>dev branch</b> is a volatile development of the master branch that can be tried out on the web at<br />
http://james-ingram-act-two.de/open-source/assistantPerformer/assistantPerformer.html<br />
Note, howevever, that this version is in active development, and may often contain bugs or not work at all. Be warned!<br />
There is currently no version of the Assistant Performer that can read the latest version of the [SVG-MIDI file format](http://james-ingram-act-two.de/open-source/svgScoreExtensions.html) produced by my Assistant Composer software, see   [Github/Moritz](https://github.com/notator/Moritz), but that is due to change in the coming months.<br />
The biggest change to the format is that scores can now contain both **_input_ and _output symbols_**, enabling much greater control over what happens when midi input information arrives during a live performance: Parallel processing can be used to enable a non-blocking, "advanced prepared piano" scenario. Single key presses can trigger either simple events or complex sequences of events, depending on how the links inside the score are organized.<br />
A simple example of a score in the new format can be viewed, but not yet performed, [here](http://james-ingram-act-two.de/open-source/assistantPerformer/scores/Study%203%20sketch%202.1%20-%20with%20input/Study%203%20sketch%202.html).

More background information about the Assistant Composer/Performer software can be found at<br /> http://james-ingram-act-two.de/moritz3/moritz3.html

January 2015<br />
James Ingram
