
import { TrackRecording } from "./TrackRecording.js";
import { Message } from "./Message.js";

export class SequenceRecording 
{
	// An empty sequenceRecording is created.
	// It has an array of empty TrackRecording objects allocated per channel index.
	// Note that the trackRecordings.length will always be maximum channel index + 1, but that the array
	// can contain undefined members (e.g. if the outputTracks argument contains a single track in channel 2).
	constructor(outputTracks)
	{
		let i, j, channel, nOutputTracks = outputTracks.length;

		this.trackRecordings = [];
		for(i = 0; i < nOutputTracks; ++i)
		{
			this.trackRecordings.push(new TrackRecording());
		}
	}

	// The data argument is a Uint8Array 
	addMessage(data, timestamp)
	{
		var channelIndex = data[0] & 0xF,
			message;

		switch(data.length)
		{
			case 1:
				message = new Message(data[0]);
				break;
			case 2:
				message = new Message(data[0], data[1]);
				break;
			case 3:
				message = new Message(data[0], data[1], data[2]);
				break;
		}
		this.trackRecordings[channelIndex].addMessage(message, timestamp);
	};

}



