
import { constants } from "./Constants.js";
import { Moment } from "./Moment.js";
const UNDEFINED_TIMESTAMP = constants.UNDEFINED_TIMESTAMP;

// Add a moment to the end of this TrackRecording using the moment's (absolute) timestamp
// field to determine whether or not to merge the moment with the current last
// moment in the trackRecording.
// Note that, contrary to TrackRecording.prototype.addMoment(), the newMoment is merged
// with the current last moment if its timestamp is _less_than_or_equal_ to the
// last moment's timestamp, and merging means _inserting_ the new messages
// _before_ the current last moment's messages.
// A new live moment's timestamp can be slightly unreliable with respect to
// existing timestamps, owing to thread switching between the score playback and
// the live performer. If the new messages are simply appended to the existing
// messages, they can override already existing noteOffs, and notes begin to hang
// in the recording (even though they may not in the live performance).
let _addLiveMoment = function(newMoment, moments)
{
	var
		timestamp = newMoment.timestamp,
		lastMoment = moments[moments.length - 1],
		lastMomentTimestamp = lastMoment.timestamp;

	if(timestamp === UNDEFINED_TIMESTAMP || lastMomentTimestamp === UNDEFINED_TIMESTAMP)
	{
		throw "Error: timestamps must be defined here.";
	}

	if(timestamp > lastMomentTimestamp)
	{
		moments.push(newMoment); // can be a rest, containing one 'empty message'
	}
	else if(timestamp <= lastMomentTimestamp)
	{
		// See the comment above.
		lastMoment.messages = newMoment.messages.concat(lastMoment.messages);
	}
};

export class TrackRecording 
{
	// An empty trackRecording is created. It contains an empty moments array.
	constructor()
	{
		this.moments = []; // an array of {timestamp, Message[]} objects
	}

	// Adds moment data to the end of this TrackRecording using the moment's (absolute) timestamp
	// field to determine whether or not to concatenate the messages with the current last moment's messages.
	// The moment.recordingData() function returns a timestamped clone of the moment's messages.
	// An exception is thrown if either the current last moment's or the new moment's
	// timestamp has the value UNDEFINED_TIMESTAMP.
	addMoment(moment)
	{
		var moments = this.moments;

		if(moments.length === 0)
		{
			moments.push(moment.recordingData()); // can be a rest, containing one 'empty message'
		}
		else
		{
			_addLiveMoment(moment.recordingData(), moments);
		}
	}

	// Called by SequenceRecording.addMessage() being called from Keyboard1.sendMIDIMessage()
	// Adds the message(a Message object) to a moment at the end of this TrackRecording
	// using the (absolute) timestamp to determine whether to add the message to the last (existing)
	// moment or to create a new moment.
	// Note that messages are recorded with their current (absolute DOMHRT) timestamp values.
	// These values are adjusted relative to the first timestamp in the recording before saving them in a Standard MIDI File.
	// In other words: the value of the earliest timestamp in the recording is subtracted from all the timestamps
	// in the recording before saving the file. 
	addMessage(message, timestamp)
	{
		var moments = this.moments, lastMoment, lastMomentTimestamp;

		function addNewMoment(moments, message, timestamp)
		{
			var newMoment = new Moment(0); // msPositionInScore is irrelevant here

			newMoment.timestamp = timestamp;
			newMoment.messages.push(message);
			moments.push(newMoment);
		}

		if(moments.length === 0)
		{
			addNewMoment(moments, message, timestamp);
		}
		else
		{
			lastMoment = moments[moments.length - 1];
			lastMomentTimestamp = lastMoment.timestamp;

			if(timestamp > lastMomentTimestamp)
			{
				addNewMoment(moments, message, timestamp);
			}
			else if(timestamp <= lastMomentTimestamp)
			{
				// See the comment above.
				lastMoment.messages.push(message);
			}
		}
	}
}
