
/*jslint bitwise: true, nomen: true, plusplus: true, white: true, continue: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, postMessage: false, setTimeout: false */

var
// moments is a one-dimensional array containing an ordered sequence of moments.
// Each moment object has a messages[] attribute -- an array containing midiMessages that are to be sent "synchronously",
// and an msPositionInSeq attribute.
moments,
momentIndex = 0,
inputControls,

currentMoment = null, // nextMoment(), tick()
speedFactor = 1.0, // nextMoment(), setSpeedFactor()
seqStartTime = -1,  // set in play(), used by nextMoment()

stop = function()
{
	"use strict";
	// stop according to the inputControls (set in "init"), possibly sending an all sound off...
	postMessage([0xB0, 120, 0]); // send all sound off (channel 0) now
},

// null is returned when there are no more moments.
nextMoment = function()
{
    "use strict";
    var nextMoment = null;
    if(momentIndex < moments.length)
    {
    	nextMoment = moments[momentIndex++];
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
        messages = moment.messages,
        i, nMessages = messages.length;

    	for(i = 0; i < nMessages; ++i)
    	{
    		postMessage(messages[i]);
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

play = function()
{
	"use strict";

	//// play the tracks according to the inputControls (set in "init").
	//// use postmessage(uint8Array) to send MIDI messages;
	//postMessage([0x90, 0x45, 0x45]); // send noteOn (channel 0) now

	//setTimeout(function()
	//{
	//	// when playing finishes...
	//  postMessage([0xB0, 120, 0]); // send all sound off (channel 0) now    
	//
	//}, 1000);
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
			inputControls = msg.inputControls;
			break;
		case "play":
			play();
			break;
		case "stop":
			stop();
			break;
		case "setSpeedFactor":
			speedFactor = msg.factor;
			break;
	}
};