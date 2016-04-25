
Introduction
------------
This is an experimental WEB MIDI application, written in HTML5 and Javascript, that gives a single performer control over the performance of music scores displayed in a browser. It uses MIDI input and output devices, and scores stored in an SVG format which has been enhanced to contain MIDI information. The lastest stable version can be tried out on the web at<br />
http://james-ingram-act-two.de/open-source/assistantPerformer/assistantPerformer.html

This project is normally tested in the latest versions of Firefox and Chrome on Windows 10. Firefox requires the <a target="_blank" href="http://jazz-soft.net">Jazz</a> plug-in to be installed. Chrome implements Web MIDI natively.<br />
To find out which other browsers could be used, go to <a target="_blank" href="http://caniuse.com/#feat=midi">check Web <em>MIDI</em> API</a>. A limited functionality is available if the browser only implements Web <em>Audio</em> (go to <a target="_blank" href="http://caniuse.com/#feat=audio-api">check Web <em>Audio</em> API</a>).<br />

Note that it is not possible to display or play scores in this application unless a MIDI output device has been selected.<br />
Scores and recordings can however be found via the link that appears when a score is selected.<br />
Currently, the only scores that can be played on the <a target="_blank" href="https://github.com/notator/residentSf2Synth">Resident Sf2 Synth</a> are the Pianola Music (1967) and Study 1 (2005).
All the other scores require hardware or software output devices that are (or depend on) plugins.<br />
On Windows, the free <a id="VirtualMIDISynthLink" target="_blank" href="http://coolsoft.altervista.org/en/virtualmidisynth">Virtual MIDI Synth</a> can be installed and used in both Firefox and Chrome.<br />
The <em>Microsoft GS Wavetable Synth</em> (part of the Windows operating system) is available in Firefox if Jazz is installed.<br />

More background information about the Assistant Composer/Performer software can be found at<br /> http://james-ingram-act-two.de/moritz3/moritz3.html

25th April 2016<br />
James Ingram
