
import { constants } from "./Constants.js";
const UNDEFINED_TIMESTAMP = constants.UNDEFINED_TIMESTAMP;

class Moment
{

	// Moment constructor
	// The moment.msPositionInChord is the position of the moment wrt its MidiChord or MidiRest.
	// it is initially set to the value sored in the score, but changes if the performance speed is not 100%.
	// During performances (when the absolute DOMHRT time is known) moment.msPositionInChord is used, with
	// the msPosition of the containing MidiChord or MidiRest, to set moment.timestamp. 
	constructor(msPositionInChord)
	{
		if(msPositionInChord === undefined || msPositionInChord < 0)
		{
			throw "Error: Moment.msPositionInChord must be defined.";
		}

		this.msPositionInChord = msPositionInChord;

		// The absolute time (DOMHRT) at which this moment is sent to the output device.
		// This value is always set in Sequence.nextMoment().
		this.timestamp = UNDEFINED_TIMESTAMP;

		this.messages = []; // an array of Messages (can be replaced)
	}

	// Adds the moment2.messages to the end of the current messages using
	// msPositionInChord attributes to check synchronousness.
	// Throws an exception if moment2.msPositionInChord !== this.msPositionInChord.
	mergeMoment(moment2)
	{
		var msPositionInChord = this.msPositionInChord;

		console.assert(msPositionInChord === moment2.msPositionInChord, "Attempt to merge moments having different msPositionInChord values.");

		this.messages = this.messages.concat(moment2.messages);
	}

	// returns an object having a timestamp and a clone of this.messages[]
	recordingData()
	{
		let rval = { timestamp: this.timestamp, messages: [] },
			rvalMessages = rval.messages;

		for(let message of this.messages)
		{
			rvalMessages.push(message.clone());
		}
		return rval;
	}
}

export { UNDEFINED_TIMESTAMP, Moment };
