Introduction
------------
This is a web MIDI application, which gives a single performer control over the performance of a music score displayed in a browser.

The project is written in HTML5 and Javascript. It uses MIDI input and output devices, and scores stored in an SVG format which has been enhanced to contain MIDI information. See: http://james-ingram-act-two.de/open-source/svgScoreExtensions.html

The Jazz plugin (http://jazz-soft.net) is currently required for MIDI support, but this will change when/if browsers implement the new Web MIDI API currently being discussed on the W3C Audio Group's public forum (http://www.w3.org/2011/audio/).

This application has only been thoroughly tested on the latest version of Chrome (Version 25.0.1364.152 m), but it should also work in other webkit browsers. 

Monophonic input, such as produced by an EWI (http://www.akaipro.com/ewiseries), is assumed. A MIDI keyboard can be used, but only one key at a time (incoming noteOffs are matched to noteOns, so playing legato is no problem). Timing is related to the times of single noteOns and noteOffs. The performance can be affected by input MIDI pitch, velocity, modulation-wheel, pitch-wheel and aftertouch or channel-pressure information, depending on the settings in the upper options panel.

Future directions: I am currently working on the creation of more scores in the necessary format. Clearly, more examples are needed. New scores could be created in several ways:

<ol>
<li>
with my existing desktop (C#) Assistant Composer software<br />
http://james-ingram-act-two.de/moritz2/assistantComposer/assistantComposer.html
</li>
<li>
with a web site for transcribing standard MIDI files.<br />
This would work rather like the Assistant Composer, and have a similar GUI but without the choice of chord symbol type, and without the krystals and palettes. The Assistant Composer already creates scores from abstract MIDI information, without further human intervention, so this problem has already been solved in principle. I, or someone else, would just have to translate the relevant parts of the (C#) program to JavaScript.
</li>
<li>
with Finale/Sibelius plugins, etc.
</li>
</ol>

A more general description of this Assistant Performer, including its rationale, can be found at<br />
http://james-ingram-act-two.de/open-source/assistantPerformer/aboutAssistantPerformer.html

====

Code
----

This project is a work-in-progress having two main branches: 'master' and 'dev'. The code in the 'master' branch defines an appplication which can be tried out publicly at
http://james-ingram-act-two.de/open-source/publicAssistantPerformer/assistantPerformer.html

The 'master' version is stable, but is possibly not the latest version of this project.<br />
The 'dev' branch is where day-to-day development is done. It does not have a public test site.

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
An interface to the Jazz plugin
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

James Ingram

March 2013


