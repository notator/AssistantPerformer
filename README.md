
Introduction
------------
This is a web MIDI application, that gives a single performer control over the performance of a music score displayed in a browser. A stable, public version (the master branch) can be tried out at<br />
http://james-ingram-act-two.de/open-source/publicAssistantPerformer/assistantPerformer.html<br />
This software has only been tested on the latest versions of Chrome and Firefox. It is not guaranteed to work in other browsers.

The project is written in HTML5 and Javascript. It uses MIDI input and output devices, and scores stored in an SVG format which has been enhanced to contain MIDI information.

WebMIDIAPI.js is a copy of the latest version of Chris Wilson's [Web MIDI API Polyfill](https://github.com/cwilso/WebMIDIAPIShim)<br />
This polyfill supplies MIDI support for browsers that do not implement the [Web MIDI API](http://webaudio.github.io/web-audio-api/), and require the [Jazz plugin](http://jazz-soft.net) to be installed on the user's computer. Firefox comes into this category.<br />
The current version of Chrome does not require the Jazz plugin to be installed, but implements the necessary parts of the Web MIDI API natively &mdash; if one turns on the corresponding switch (search for 'midi' in chrome://flags).

The Assistant Performer's master branch currently assumes monophonic input. A MIDI keyboard can be used, but only one key at a time (incoming noteOffs are matched to noteOns, so playing legato is no problem). Timing is related to the times of single noteOns and noteOffs. In addition to noteOn/Off, pitch and velocity information, the performance can also be affected by the instrument's continuous controllers - modulation-wheel, pitch-wheel and aftertouch or channel-pressure.

The Assistant Performer cannot currently (December 2014) read the latest version of the [SVG-MIDI file format](http://james-ingram-act-two.de/open-source/svgScoreExtensions.html) produced by my [Assistant Composer software](https://github.com/notator/Moritz), but that is due to change in the coming months.<br />
The biggest change to the format is that scores can now contain both **_input_ and _output chords_**, enabling much greater control over what happens when midi input information arrives during a live performance: Parallel processing can be used to enable a non-blocking, "advanced prepared piano" scenario. Single key presses can trigger either simple events or complex sequences of events, depending on how the links inside the score are organized.<br />
An example of a score in the new format can be viewed, but not yet performed, [here](http://james-ingram-act-two.de/open-source/assistantPerformer/scores/Study%203%20sketch%202.1%20-%20with%20input/Study%203%20sketch%202.html).

A more general description of the Assistant Performer, including its rationale, can be found at<br />
http://james-ingram-act-two.de/open-source/assistantPerformer/aboutAssistantPerformer.html

========

The Code
--------

This project is a work-in-progress, and currently has three branches: 'master', 'SongSixNoWorkers', and 'dev'.<br />
<br />
The '<b>master</b>' branch defines an appplication which can be tried out publicly at<br />
http://james-ingram-act-two.de/open-source/publicAssistantPerformer/assistantPerformer.html<br />
This 'master' version is stable, but is not the latest version of this project. It can play the scores 'Study 2c3.1' and 'Study 3 sketch', neither of which were designed specifically to be performed live.<br />
<br />
The '<b>SongSixNoWorkers</b>' branch is also stable (March 2014), and was designed for live performance of the score '<em>Song Six</em>' (which <b>was</b> designed for interaction with a live performer).<br />
When performing live, in concert, one can't rely on having a stable web connection, so the program in this branch can also be used off-line, using only local files on the user's computer. Unfortunately, '<em>Song Six</em>' requires the installation of a special soundFont, making it impossible for visitors to a public website to play correctly. The 'SongSixNoWorkers' branch therefore has no public website. The score, and a Flash/mp3 recording can however be found at<br />
http://james-ingram-act-two.de/compositions/songSix/setting1Score/Song%20Six.html<br />
<br />
The '<b>dev</b>' branch is a volatile development of the 'SongSixNoWorkers' branch. It does not yet support the new SVG-MIDI file format produced by the Assistant Composer. When complete, it will use web workers to implement the "advanced prepared piano" scenario. This 'dev' branch changes quite a lot, and is used for testing possibly buggy code, so it does not have a public, online test site.<br />

Again: Work is due to continue on the Assistant Performer (possibly in a new development branch) in January 2015.

December 2014<br />
James Ingram
