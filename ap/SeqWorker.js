
var tracks, workerIndex,

play = function(tracksArg, inputControlsArg, workerIndexArg)
{
	tracks = tracksArg;
	workerIndex = workerIndexArg;

	// play the tracks, using postmessage(uint8Array) to send MIDI messages;
	postMessage([0x90, 0x45, 0x45]); // noteOn (channel 0)

	setTimeout(function()
	{
		// when playing finishes...
		postMessage([0xB0, 120, 0]); // all sound off (channel 0)
		postMessage({ workerIsBusy: false, workerIndex: workerIndex });

	}, 500);
},

stop = function(inputControlsArg)
{
	// do stopping, then
	postMessage({ workerIsBusy: false, workerIndex: workerIndex });
},

setSpeedFactor = function(factor)
{
	// TODO
},

onmessage = function(e)
{
	//console.log('Message received from main script');
	msg = e.data;
	switch(msg.action)
	{
		case "play":
			play(msg.tracks, msg.inputControls, msg.workerIndex);
			break;
		case "stop":
			stop(msg.inputControls);
			break;
		case "setSpeedFactor":
			setSpeedFactor(msg.factor);
	}
}