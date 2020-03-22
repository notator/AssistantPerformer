
import { constants } from "./Constants.js";
import { RegionLink } from "./RegionLink.js";
import { MidiChord } from "./MidiObject.js";
import { RegionControls } from "./RegionControls.js";

export class Track
{
	constructor()
	{
		this.currentMoment = null;
		this.midiObjects = [];
		this.isOn = true;
		this.hasEndedRegion = false;
		this._regionLinks = [];
		this._currentMidiObjectIndex = -1;
		this._currentMidiObject = null;
	}

	finalBarlineMsPosition()
	{
		let lastMidiObject, finalBarlineMsPos;
		if(this.midiObjects === undefined)
		{
			throw "Can't get finalBarlineMsPosition!";
		}
		lastMidiObject = this.midiObjects[this.midiObjects.length - 1];
		finalBarlineMsPos = lastMidiObject.msPositionInScore + lastMidiObject.msDurationInScore;
		return finalBarlineMsPos;
	}

	setRegionLinks(regionSequence)
	{
		let prevRegionLink = undefined;
		for(let i = 0; i < regionSequence.length; ++i)
		{
			let regionDef = regionSequence[i],
				regionLink = new RegionLink(this.midiObjects, regionDef, prevRegionLink);

			prevRegionLink = regionLink;
			this._regionLinks.push(regionLink);
		} 
	}

	setOutputSpan(trackIndex, startMarkerMsPositionInScore, endMarkerMsPositionInScore, regionStartMsPositionsInScore)
	{
		// Sets track._currentMidiObjectIndex, track._currentMidiObject and track.currentMoment.
		// If a MidiChord starts at or straddles the startMarker, it becomes the track._currentMidiObject, and
		// track.currentMoment is set to the its first moment at or after the startMarker.
		// If a MidiRest begins at the startMarker, it becomes the track._currentMidiObject, and
		// track.currentMoment is set to its (only) moment (which may be empty).
		// If a MidiRest straddles the startMarker, track._currentMidiObject is set to the following MidiChord, and
		// track.currentMoment is set to the its first moment.
		// track._currentMidiObjectIndex is the index of the track._currentMidiObject, in track.midiObjects. 
		function setInitialTrackState(that, startMarkerMsPositionInScore, endMarkerMsPositionInScore)
		{
			var i, index = -1, midiObject, midiChord, midiRest, nMidiObjects;
			if(that.midiObjects === undefined)
			{
				throw "Can't set OutputSpan!";
			}
			nMidiObjects = that.midiObjects.length;
			for(i = 0; i < nMidiObjects; ++i)
			{
				// find the index of the MidiChord straddling or at the startMarkerMsPositionInScore,
				// or the index of the MidiChord that starts after the startMarkerMsPositionInScore
				// or the index of a MidiRest that starts at or after the startMarkerMsPositionInScore.
				if(that.midiObjects[i] instanceof MidiChord)
				{
					midiChord = that.midiObjects[i];
					if((midiChord.msPositionInScore <= startMarkerMsPositionInScore)
						&& (midiChord.msPositionInScore + midiChord.msDurationInScore > startMarkerMsPositionInScore))
					{
						// if the MidiChord is at or straddles the startMarkerMsPositionInScore
						// set its moment pointers to startMarkerMsPositionInScore
						// midiChord.currentMoment will be undefined if there are no moments at or after startMarkerMsPositionInScore.
						midiChord.setToStartMarker(startMarkerMsPositionInScore);
						if(midiChord.currentMoment !== undefined)
						{
							index = i;
							break;
						}
					}
					if(midiChord.msPositionInScore > startMarkerMsPositionInScore)
					{
						// a MidiRest straddles the startMarker. 
						midiChord.setToStartAtBeginning();
						index = i;
						break;
					}
				}
				else if(that.midiObjects[i].msPositionInScore >= startMarkerMsPositionInScore)
				{
					midiRest = that.midiObjects[i];
					midiRest.setToStartAtBeginning();
					index = i;
					break;
				}
			}

			if(index === -1)
			{
				// Set that._currentMidiObject to null if there are no more moments to play in the track.
				// (The last midiObject in the track has no moments between the start and endMarkers.)
				that._currentMidiObjectIndex = -1;
				that._currentMidiObject = null;
				that.currentMoment = null;
			}
			else
			{
				// that.currentMoment is the first moment that is going to be played in that track.
				// (If the performance is set to start inside a rest, that.currentMoment will be at a
				// position later than the startMarker.)
				// Set all further MidiChords and MidiRests up to the endMarker to start at their beginnings.
				for(i = index + 1; i < nMidiObjects; ++i)
				{
					midiObject = that.midiObjects[i];
					if(midiObject.msPositionInScore >= endMarkerMsPositionInScore)
					{
						break;
					}
					midiObject.setToStartAtBeginning();
				}
				that._currentMidiObjectIndex = index;
				that._currentMidiObject = that.midiObjects[index];
				that.currentMoment = that._currentMidiObject.currentMoment; // a MidiChord or MidiRest
				that.currentMoment = (that.currentMoment === undefined) ? null : that.currentMoment;
			}
  
			that.hasEndedRegion = false;
		}

		// Adds the current Controller messages to the Moment at or immediately after the beginning of each region.
		// Messages are only added if a corresponding message does not already exist in the moment.
		// Messages are added to the first Moment in the track, even if the first region starts later.
		// TODO! Take account of pitchWheel deviation!
		function setInitialRegionMomentControls(that, trackIndex, startMarkerMsPositionInScore, endMarkerMsPositionInScore, regionStartMsPositionsInScore)
		{
			/**
			 * 
			 * @param {[]} midiObjects an array of MidiObject
			 * @returns {number} -1 if there are no NoteOns in the midiObjects
			 */
			function getChannelIndexFromNoteOnMessages(midiObjects)
			{
				let channel = -1;
				for(let midiObject of midiObjects)
				{
					for(let moment of midiObject.moments)
					{
						for(let msg of moment.messages)
						{
							if(msg.command() === constants.COMMAND.NOTE_ON)
							{
								channel = msg.channel();
								break;
							}
						}
						if(channel >= 0)
						{
							break;
						}
					}
					if(channel >= 0)
					{
						break;
					}
				}
				return channel;
			}

			if(regionStartMsPositionsInScore.indexOf(0) < 0)
			{
				regionStartMsPositionsInScore.push(0);
			}

			let prevStartMsPos = -1,
				regionIndex = 0,
				regionStartMsPos = regionStartMsPositionsInScore[regionIndex++],
				noteOnsChannel = getChannelIndexFromNoteOnMessages(that.midiObjects);

			if(noteOnsChannel !== -1 && noteOnsChannel !== trackIndex)
			{
				throw new Error(`
Error: The channel index must always be equal to the track
index, even if there are no NoteOn messages in the channel.`
				);				
			}
 
			let regionControls = new RegionControls(trackIndex), // initially contains default values for the controls
				done = false;


			for(let midiObject of that.midiObjects)
			{
				let moMsPos = midiObject.msPositionInScore;
				if(moMsPos < startMarkerMsPositionInScore)
				{
					continue;
				}
				if(moMsPos >= endMarkerMsPositionInScore)
				{
					break;
				}
				let moments = midiObject.moments;
				for(let moment of moments)
				{
					// set the corresponding currentControls values to the specific values in the moment controls.
					regionControls.updateFrom(moment);
					if((moMsPos + moment.msPositionInChord) >= regionStartMsPos)
					{
						// set  moment controls to all the values in currentControls
						regionControls.update(moment);
						if(regionIndex === regionStartMsPositionsInScore.length)
						{
							done = true;
						}
						prevStartMsPos = regionStartMsPos;
						regionStartMsPos = regionStartMsPositionsInScore[regionIndex++];
						if(regionStartMsPos <= prevStartMsPos)
						{
							// N.B. There is only one regionStartMsPos per region here (even if they repeat in the score)
							throw "regionStartMsPos must be in chronological order.";
						}
					}
				}
				if(done)
				{
					break;
				}
			}
		}
		setInitialTrackState(this, startMarkerMsPositionInScore, endMarkerMsPositionInScore);
		setInitialRegionMomentControls(this, trackIndex, startMarkerMsPositionInScore, endMarkerMsPositionInScore, regionStartMsPositionsInScore);
	}

	// ** Compare this code with setInitialTrackState() inside setOutputSpan() above. **
	// When this function returns:
	// this.currentMoment is the first moment that is going to be played in this track.
	// (If the performance is set to start inside a rest, this.currentMoment will be in
	// a midiChord that starts after the beginning of the region.)
	// this.currentMoment will be null if there are no more moments to play in the track
	// (i.e. if last midiObject in the track is a rest, and the performance is set to start
	// after its beginning).
	_setNextRegion(regionLink)
	{
		let i, startMidiObjectIndex = -1, momentIndex = -1, nMidiObjectsInRegion = -1, moIndex = -1;
		if(regionLink.nextRegionMidiObjectIndex === undefined
			|| regionLink.nextRegionMomentIndex === undefined
			|| regionLink.nextRegionMidiObjectsCount === undefined)
		{
			throw "Can't set next region.";
		}
		startMidiObjectIndex = regionLink.nextRegionMidiObjectIndex;
		momentIndex = regionLink.nextRegionMomentIndex;
		nMidiObjectsInRegion = regionLink.nextRegionMidiObjectsCount;
		// set all midiObjects in the region except the first (which is set by setting the 'current' values below)
		moIndex = startMidiObjectIndex + 1;
		for(i = 1; i < nMidiObjectsInRegion; ++i)
		{
			this.midiObjects[moIndex++].setToStartAtBeginning();
		}
		this._setState(startMidiObjectIndex, momentIndex);
		// The current ContinuousController state commands must be added
		// to the the first moment in each region before the performance begins.
	}
	moveToNextRegion(regionIndexInPerformance)
	{
		/* track.regionLinks is an array of regionLink objects that have the following attributes:
		 *     .endOfRegionMsPositionInScore
		 *     .nextRegionMidiObjectIndex // the index of the midiObject containing the first moment at or after the startMsPositionInScore of the toRegion.
		 *     .nextRegionMomentIndex // the index (in midiObject.moments) of the first moment at or after the startMsPositionInScore of the toRegion
		 *     .nextRegionMidiObjectsCount // includes midiObjects that straddle the region boundaries.
		 * each Track has its own regionLinks array, and maintains its own regionIndex for the current region
		 *
		 * The current ContinuousController state commands are added to the the first moment in each region before the performance begins.
		 */
		let currentRegionLink = this._regionLinks[regionIndexInPerformance];
		this._setNextRegion(currentRegionLink);
	}
	// Called at the end of a performance to reset the initial state (for further performances).
	setToFirstRegion()
	{
		let regionLink = this._regionLinks[0], endMsPosInScore = regionLink.endOfRegionMsPositionInScore;
		for(let midiObject of this.midiObjects)
		{
			if(midiObject.msPositionInScore < endMsPosInScore)
			{
				midiObject.setToStartAtBeginning();
			}
			else
			{
				break;
			}
		}
		this._setState(0, 0);
	}
	// Returns Number.MAX_VALUE at end of track.
	currentMsPosition()
	{
		let msPos = Number.MAX_VALUE;
		if(this._currentMidiObject !== null)
		{
			msPos = this._currentMidiObject.msPositionInScore;
			if(this.currentMoment !== null)
			{
				msPos += this.currentMoment.msPositionInChord;
			}
		}
		return msPos;
	}
	advanceCurrentMoment()
	{
		if(this._currentMidiObject === null)
		{
			throw "Application error.";
		}
		var currentIndex;
		this.currentMoment = this._currentMidiObject.advanceCurrentMoment();
		// MidiRests, and MidiChords that have ended, return null.
		if(this.currentMoment === null)
		{
			this._currentMidiObjectIndex++;
			currentIndex = this._currentMidiObjectIndex;
			if(currentIndex < this.midiObjects.length)
			{
				this._currentMidiObject = this.midiObjects[currentIndex];
				this.currentMoment = this._currentMidiObject.currentMoment; // is non-null and has zero or more messages
			}
			else
			{
				this._currentMidiObject = null;
				this.currentMoment = null;
			}
		}
	}

	_setState(midiObjectIndex, momentIndexInChord)
	{
		this._currentMidiObjectIndex = midiObjectIndex;
		this._currentMidiObject = this.midiObjects[midiObjectIndex]; // a MidiChord or MidiRest
		this.currentMoment = this._currentMidiObject.moments[momentIndexInChord]; // in a MidiChord or MidiRest
		this.currentMoment = (this.currentMoment === undefined) ? null : this.currentMoment;
		this.hasEndedRegion = false; // is temporarily set to true when the track comes to the end of a region during a performance
	}
}
