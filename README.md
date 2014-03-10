
Introduction
------------
This is a web MIDI application, which gives a single performer control over the performance of a music score displayed in a browser. A stable, public version (the master branch) can be tried out at<br />
http://james-ingram-act-two.de/open-source/publicAssistantPerformer/assistantPerformer.html<br />
This has only been tested on the latest versions of Chrome and Firefox, and is not guaranteed to work in other browsers.

The project is written in HTML5 and Javascript. It uses MIDI input and output devices, and scores stored in an SVG format which has been enhanced to contain MIDI information. See:<br />
http://james-ingram-act-two.de/open-source/svgScoreExtensions.html<br />

The file midiLib/WebMIDIAPI.js has been copied from Chris Wilson's Web MIDI API Polyfill at GitHub:<br />
https://github.com/cwilso/WebMIDIAPIShim<br />
This code supplies MIDI support in browsers, and requires the <b>Jazz plugin</b> (http://jazz-soft.net) to be installed on the user's computer. Both the Jazz plugin and Chris Wilson's polyfill will become obsolete as soon as the Web MIDI API is actually implemented in browsers. For more details on the Web MIDI API, see: <br />
http://www.w3.org/2011/audio/.

Monophonic input, such as produced by an EWI (http://www.akaipro.com/ewiseries), or R2M (http://www.doepfer.de/R2M.htm) is currently assumed. A MIDI keyboard can be used, but only one key at a time (incoming noteOffs are matched to noteOns, so playing legato is no problem). Timing is related to the times of single noteOns and noteOffs. In addition to noteOn/Off, pitch and velocity information, the performance can also be affected by the instrument's continuous controllers - modulation-wheel, pitch-wheel and aftertouch or channel-pressure.

A more general description of this Assistant Performer, including its rationale, can be found at<br />
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
The '<b>SongSixNoWorkers</b>' branch is also stable (March 2014), and was designed for live performance of the score '<em>Song Six</em>' (which <b>was</b> designed for interaction with a live performer). When performing live, in concert, one can't rely on having a stable web connection, so the program in this branch can also be used off-line, using only local files on the user's computer. Unfortunately, '<em>Song Six</em>' requires the installation of a special soundFont, making it awkward for visitors to a public website to play correctly. The 'SongSixNoWorkers' branch therefore has no public website. The score, and a Flash/mp3 recording can however be found at<br />
http://james-ingram-act-two.de/compositions/songSix/setting1Score/Song%20Six.html<br />
<br />
The '<b>dev</b>' branch is volatile, and currently contains a development of the 'SongSixNoWorkers' branch that uses <b>web workers</b> to play the individual tracks of a score. This paradigm means that the number of MIDI events to be played need not be fixed before a live performance begins. This, in turn, means that the score can react more flexibly to the live performer's input timings. This 'dev' branch changes quite a lot, and is used for testing possibly buggy code, so it does not have a public test site.<br />

Future directions: When the web workers version of this program is working, I need to solve the problem of getting soundFonts working online. Hopefully, other people will find this (or an equivalent solution) useful, and it will be possible to cooperate...

The folders contain code and code documentation as follows: 

<strong>ap</strong> - The application files.
<ul>
<li>
AssistantPerformerJSOverview.txt - An overview of the content of the files in the ap folder.
</li>
<li>
Files containing the Javascript code for this application - These files use (are dependent on) the files in all the other folders.
</li>
</ul>

<strong>midiLib</strong> - A MIDI library.
<ul>
<li>
MIDILibOverview.txt - An overview of the content of the files in the midiLib folder.
</li>
<li>
Files containing Javscript code for a MIDI library:
<ul>
<li>
MIDI constant definitions
</li>
<li>
WebMIDIAPI.js: Chris Wilson's wrapper for the Jazz plugin
</li>
<li>
Definitions of the objects
<ul>
<li>
Message
</li>
<li>
Moment
</li>
<li>
Track
</li>
<li>
Sequence
</li>
</ul>
</li>
<li>
A Sequence to Standard MIDI File conversion function.
</li>
</ul>
</li>
</ul>
<strong>cursors</strong> - cursors used by the files in the ap folder.<br />
<br />
<strong>images</strong> - images used by the files in the ap folder.<br />
<br />
<strong>scores</strong> - scores used by the files in the ap folder.<br />
<br />




