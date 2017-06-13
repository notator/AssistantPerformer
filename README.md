
Introduction
------------
This is an experimental WEB MIDI application, written in HTML5 and Javascript, that gives a single performer control over the performance of music scores displayed in a browser. It uses MIDI input and output devices, and scores stored in an SVG format which has been enhanced to contain MIDI information. The lastest stable version can be tried out on the web at<br />
http://james-ingram-act-two.de/open-source/assistantPerformer/assistantPerformer.html

This application is normally tested in the latest version of Chrome on Windows 10.<br />
I will be testing it again on Firefox, when they have completed their implementation of the Web MIDI API (currently in the pipeline).
To find out which other browsers might be tried, go to
<a target="_blank" href="http://caniuse.com/#feat=midi">check Web <em>MIDI</em> API</a>.
<br /><br />

Note that it is not possible to display or play scores in this application unless a MIDI output device has been selected.<br />
The <a target="_blank" href="https://github.com/notator/residentSf2Synth"> <em>Resident Sf2 Synth</em></a> should always be available, since it only requires the Web <em>Audio</em> API, and that interface is always implemented when the Web <em>MIDI</em> API is implemented (go to <a target="_blank" href="http://caniuse.com/#feat=audio-api">check Web <em>Audio</em> API</a>).<br />
Currently, the only scores that can be played on the <em>Resident Sf2 Synth</em> are the Pianola Music (1967) and Study 1 (2005).
All the other scores require hardware or software output devices that are (or depend on) plugins.<br />
On Windows, the free <a id="VirtualMIDISynthLink" target="_blank" href="http://coolsoft.altervista.org/en/virtualmidisynth"><em>Virtual MIDI Synth</em></a> plugin can be used to play any of the available scores.<br />
Scores, recordings and some videos of the Assistant Performer performing can however be found via the link that appears when a score is selected.<br /><br />

The following <b>mp4 videos featuring Study 2</b> illustrate some of this software's more advanced features for those who don't want to install the <em>Virtual MIDI Synth</em>.
Unfortunately, Study 2 can't yet be performed on the <em>Resident Sf2 Synth</em>:

* A complete performance of Study 2 (at the speed stored in the score):<br />
<a target="_top" href="http://james-ingram-act-two.de/compositions/study2/study2Video100.html">View online (with comments)</a> /
<a href="http://james-ingram-act-two.de/compositions/study2/videos/Study_2_100pc_09.06.2017.mp4">right-click to download mp4 (for better rendering)</a>.
* A demonstration of the Assistant Performer's basic functions (track selection, speed etc.):<br />
<a target="_top" href="http://james-ingram-act-two.de/compositions/study2/study2VideoSelectionDemos.html">View online (with comments)</a> /
<a href="http://james-ingram-act-two.de/compositions/study2/videos/Study_2_selections_09.06.2017.mp4">right-click to download mp4 (for better rendering))</a>.
* A demonstration of the Assistant Performer's live conducting option:<br />
<a target="_top" href="http://james-ingram-act-two.de/compositions/study2/study2VideoSlowBlueSection.html">View online (with comments)</a> /
<a href="http://james-ingram-act-two.de/compositions/study2/videos/Study_2_slow_conducted_09.06.2017.mp4">right-click to download mp4 (for better rendering)</a>.
<br />
12th June 2017<br />
James Ingram

