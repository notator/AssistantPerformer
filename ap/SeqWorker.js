
/*jslint bitwise: true, nomen: true, plusplus: true, white: true, continue: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, postMessage: false, setTimeout: false */

var
// moments is a one-dimensional array containing an ordered sequence of moments.
// Each moment object has a messages[] attribute -- an array containing midiMessages that are to be sent "synchronously",
// and an msPositionInSeq attribute.
moments,
momentIndex = 0,
inputControls,

stop = false,
nAllMoments,
currentMomentNumber = 0,
fadeLength = -1,

currentMoment = null, // nextMoment(), tick()
speedFactor = 1.0, // nextMoment(), setSpeedFactor()
seqStartTime = -1,  // set in doNoteOn(), used by nextMoment()

doNoteOff = function()
{
	"use strict";

	function setFade()
	{
		fadeLength = nAllMoments - currentMomentNumber;
	}

	switch(inputControls.noteOff)
	{
		case "stop":
			stop = true;
			console.log("doNoteOff: stop is true.");
			break;
		case "fade":
			stop = true;
			console.log("doNoteOff: setFade().");
			setFade();
			break;
		default:
			break; // "ignore" do nothing (allow the Seq to complete) 
	}
	// stop according to the inputControls (set in "init"), possibly sending an all sound off...
	
},

// null is returned when there are no more moments.
nextMoment = function()
{
    "use strict";
    var nextMoment = null;
    if(momentIndex < nAllMoments)
    {
    	nextMoment = moments[momentIndex++];
    	currentMomentNumber++;
    }
    return nextMoment; // null stops tick().
},
   
tick = function()
{
    "use strict";
    var
    delay;

    function sendMessages(moment)
    {
    	var
        message, messages = moment.messages,
        i, nMessages = messages.length,
        newVelocity;

    	for(i = 0; i < nMessages; ++i)
    	{
    		message = messages[i];
    		if(fadeLength > 0 && message[0] >= 0x90 && message[0] < 0xA0)
    		{
				newVelocity = message[2] * (nAllMoments - currentMomentNumber) / fadeLength; // scale the velocity
    			// a NoteOn
				message = new Uint8Array([message[0], message[1], newVelocity]);	
    		}
    		postMessage(message);
    	}
    }

    function getDelay(moment)
    {	
    	return (moment.msPositionInSeq - (performance.now() - seqStartTime)) / speedFactor;
    }

    if(currentMoment === null)
    {
    	return;
    }

    delay = getDelay(currentMoment);
 
    while(delay <= 0)
    {
    	if(stop === true && fadeLength < 0)
    	{
    		console.log("stopping tick().");
    		postMessage([0xB0, 120, 0]); // send all sound off (channel 0) now
    		return;
    	}
    	if(currentMoment.messages.length > 0) // rest moments can be empty
    	{
    		sendMessages(currentMoment);
    	}

    	currentMoment = nextMoment();

    	if(currentMoment === null)
    	{
    		return;
    	}

    	delay = getDelay(currentMoment);
    }

    setTimeout(tick, delay);  // schedules the next tick.
},

// play the tracks according to the inputControls (set in "init").
doNoteOn = function()
{
	"use strict";

	console.log("worker says: moments.length is: " + moments.length);

	seqStartTime = performance.now();

	console.log("worker says: seqStartTime: " + seqStartTime);

	currentMoment = nextMoment();
	if(currentMoment === null)
	{
		return;
	}
	tick();
},

onmessage = function(e)
{
	"use strict";
	//console.log('Message received from Seq.');
	var msg = e.data;
	switch(msg.action)
	{
		case "init":
			moments = msg.moments;
			nAllMoments = moments.length;
			inputControls = msg.inputControls;
			break;
		case "play":
			doNoteOn();
			break;
		case "stop":
			console.log("worker received noteOff()");
			doNoteOff();
			break;
		case "setSpeedFactor":
			speedFactor = msg.factor;
			break;
	}
};