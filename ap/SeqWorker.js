
var tracks, inputControls,

play = function()
{
	"use strict";

	console.log("worker says: tracks[0].midiObjects.length is: " + tracks[0].midiObjects.length);

	// play the tracks according to the inputControls (set in "init").
	// use postmessage(uint8Array) to send MIDI messages;
	postMessage([0x90, 0x45, 0x45]); // noteOn (channel 0)

	setTimeout(function()
	{
		// when playing finishes...
		postMessage([0xB0, 120, 0]); // all sound off (channel 0)

	}, 1000);
},

stop = function()
{
	"use strict";
	// stop according to the inputControls (set in "init"), possibly sending an all sound off...
	postMessage([0xB0, 120, 0]); // all sound off (channel 0)
},

setSpeedFactor = function(factor)
{
	"use strict";
	// TODO
},

onmessage = function(e)
{
	"use strict";
	//console.log('Message received from Seq.');
	var msg = e.data;
	switch(msg.action)
	{
		case "init":
			tracks = msg.tracks;
			inputControls = msg.inputControls;
			break;
		case "play":
			play();
			break;
		case "stop":
			stop();
			break;
		case "setSpeedFactor":
			setSpeedFactor(msg.factor);
			break;
	}
};