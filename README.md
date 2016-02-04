
This is a developing, experimental Web MIDI application, written in HTML5 and Javascript, that gives a single performer control over the performance of music scores displayed in a browser. It uses MIDI input and output devices, and scores stored in an SVG format which has been enhanced to contain MIDI information. The latest stable version can be tried out on the web at<br />
[http://james-ingram-act-two.de/open-source/assistantPerformer/assistantPerformer.html](http://james-ingram-act-two.de/open-source/assistantPerformer/assistantPerformer.html).<br />
<br />
This application is normally tested in the latest versions of Firefox and Chrome on Windows 10. Firefox requires the [Jazz](http://jazz-soft.net) plug-in to be installed. Chrome implements Web MIDI natively. [1]<br />
<br />
Note that it is not possible to display or play scores unless a MIDI output device has been selected. Scores and recordings can however be found via a link that appears when a score is selected.<br />
In January 2016, I added the [Resident Sf2 Synth](https://github.com/notator/residentSf2Synth) to the list of available MIDI output devices. This is a software device that only requires Web _Audio_ support (it doesn't require Web _MIDI_). Currently, the only score that can be played on the Resident Sf2 Synth is the _Pianola Music (1967)_. All the other scores require hardware or software output devices that are (or depend on) plugins.<br />
On Windows, the free [Virtual MIDI Synth](http://coolsoft.altervista.org/en/virtualmidisynth) can be installed and used in both Firefox and Chrome. The _Microsoft GS Wavetable Synth_ (part of the Windows operating system) is available in Firefox if Jazz is installed.<br />

February 2016<br />
James Ingram<br />

[1] To find out which other browsers might be used, go to [check Web *MIDI* API](http://caniuse.com/#feat=midi) and [check Web *Audio* API](http://caniuse.com/#feat=audio-api).
