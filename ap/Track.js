/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/Track.js
 *  The _AP.track namespace which defines the
 *      Track() empty Track constructor.
 *
 *  Public Interface:
 *      midiObjects // a temporally sorted array of MidiChords and midiRests
 *      _currentMidiObject = null; // The MidiChord or MidiRest currently being played by this track.
 *      currentMoment = null; // the moment which is about to be played by the _currentMidiObject (which must be a midiObject).
 *
 *      The following attributes are "private" -- should not need to be used by track's clients:
 *          _currentMidiObjectIndex
 *          _indexOfLastPerformedMidiObjectInAssistedSpan
 *
 *  Public functions (defined in prototype)
 *      finalBarlineMsPosition()
 *      setForSpan(startMarkerMsPositionInScore, endMarkerMsPositionInScore)
 *      currentMsPosition()
 *      advanceCurrentMoment()
 */

/*jslint white */
/*global WebMIDI, _AP,  window,  document */

_AP.namespace('_AP.track');

_AP.track = (function()
{
    "use strict";
	var
	MidiChord = _AP.midiChord.MidiChord,
    // An empty track is created.
    Track = function()
    {
        if(!(this instanceof Track))
        {
            return new Track();
        }

        this._currentMidiObject = null; // The MidiChord or MidiRest currently being played by this track.
        this.currentMoment = null; // the moment which is about to be played by the _currentMidiObject (if it is a MidiChord or MidiRest). 
        this._currentMidiObjectIndex = -1; // the current index in this track's midiObjects or inputObjects array
    },

    publicTrackAPI =
    {
        // creates an empty track
        Track: Track
    };
    // end var

    Track.prototype.finalBarlineMsPosition = function()
    {
        var lastMidiObject = this.midiObjects[this.midiObjects.length - 1],
            finalBarlineMsPos = lastMidiObject.msPositionInScore + lastMidiObject.msDurationInScore;

        return finalBarlineMsPos;
    };

	// Sets track._currentMidiObjectIndex and track._currentMidiObject:
	// track._currentMidiObjectIndex is the index of track._currentMidiObject, which is the first
	// InputChord or InputRest at or after the startMarkerMsPositionInScore.
	// Also sets track.currentMoment to null (track.currentMoment is always null, and ignored in inputTracks) 
    Track.prototype.setForInputSpan = function(startMarkerMsPositionInScore)
    {
    	var i, index, inputObjects = this.inputObjects,
    		nTimeObjects = inputObjects.length;

    	for(i = 0; i < nTimeObjects; ++i)
    	{
    		index = i;
    		// find the index of the first inputChord or inputRest at or after startMarkerMsPositionInScore
    		if(inputObjects[i].msPositionInScore >= startMarkerMsPositionInScore)
    		{
    			break;
    		}
    	}

    	this._currentMidiObjectIndex = index;
    	this._currentMidiObject = inputObjects[index];
    	this.currentMoment = null; // always null for inputChords and inputRests
    };

	// Sets track._currentMidiObjectIndex, track._currentMidiObject and track.currentMoment.
	// If a MidiChord starts at or straddles the startMarker, it becomes the track._currentMidiObject, and
	// track.currentMoment is set to the its first moment at or after the startMarker.
	// If a MidiRest begins at the startMarker, it becomes the track._currentMidiObject, and
	// track.currentMoment is set to its (only) moment (which may be empty).
	// If a MidiRest straddles the startMarker, track._currentMidiObject is set to the following MidiChord, and
	// track.currentMoment is set to the its first moment.
	// track._currentMidiObjectIndex is the index of the track._currentMidiObject, in track.midiObjects. 
    Track.prototype.setForOutputSpan = function(startMarkerMsPositionInScore, endMarkerMsPositionInScore)
    {
    	var i, index, midiObject, midiObjects = this.midiObjects,
			midiChord, nMidiObjects = midiObjects.length;

    	for(i = 0; i < nMidiObjects; ++i)
    	{
    		index = i;
    		// find the index of the MidiChord straddling or at the startMarkerMsPositionInScore,
    		// or the index of the MidiChord that starts after the startMarkerMsPositionInScore
    		// or the index of a MidiRest that starts at the startMarkerMsPositionInScore.
    		if(midiObjects[i] instanceof MidiChord)
    		{
    			midiChord = midiObjects[i];
    			if((midiChord.msPositionInScore <= startMarkerMsPositionInScore)
				&& (midiChord.msPositionInScore + midiChord.msDurationInScore > startMarkerMsPositionInScore))
    			{
    				// if the MidiChord is at or straddles the startMarkerMsPositionInScore
    				// set its moment pointers to startMarkerMsPositionInScore
    				// midiChord.currentMoment will be undefined if there are no moments at or after startMarkerMsPositionInScore.
    				midiChord.setToStartMarker(startMarkerMsPositionInScore);
    				if(midiChord.currentMoment !== undefined)
    				{
    					break;
    				}
    			}

    			if(midiChord.msPositionInScore > startMarkerMsPositionInScore)
    			{
    				// a MidiRest straddles the startMarker. 
    				midiChord.setToStartAtBeginning();
    				break;
    			}
    		}
    		else if(midiObjects[i].msPositionInScore === startMarkerMsPositionInScore)
    		{
    			// a MidiRest
    			break;
    		}
    	}

    	this._currentMidiObjectIndex = index;
    	this._currentMidiObject = midiObjects[index];
    	this.currentMoment = this._currentMidiObject.currentMoment;// a MidiChord or MidiRest

    	// Set all further MidiChords up to the endMarker to start at their beginnings.
    	for(i = index + 1; i < nMidiObjects; ++i)
    	{
    		midiObject = midiObjects[i];

    		if(midiObject.msPositionInScore >= endMarkerMsPositionInScore)
    		{
    			break;
    		}

    		if(midiObjects[i] instanceof MidiChord)
    		{ 
    			midiObject.setToStartAtBeginning();
    		}
    	}
    };

    // Returns Number.MAX_VALUE at end of track.
    Track.prototype.currentMsPosition = function()
    {
    	var msPos = Number.MAX_VALUE,
            cmObj = this._currentMidiObject,
            cMom = this.currentMoment;

    	if(cmObj !== null)
        {
        	if(cmObj instanceof _AP.midiChord.MidiChord)
        	{
        		msPos = cmObj.msPositionInScore + cMom.msPositionInChord;
        	}
        	else
        	{
        		// a rest
        		msPos = cmObj.msPositionInScore;
        	}
        }

        return msPos;
    };

    Track.prototype.advanceCurrentMoment = function()
    {
    	var currentIndex;

    	if(this.class === "inputTrack")
    	{
    		throw "Can't advance moments in input tracks. InputTracks don't have moments.";
    	}

        this.currentMoment = this._currentMidiObject.advanceCurrentMoment();

    	// MidiRests, and MidiChords that have ended, return null.
        if(this.currentMoment === null)
        {
            this._currentMidiObjectIndex++;
            currentIndex = this._currentMidiObjectIndex;
            if(currentIndex < this.midiObjects.length)
            {
                this._currentMidiObject = this.midiObjects[currentIndex];
                this.currentMoment = this._currentMidiObject.currentMoment;  // is non-null and has zero or more messages
            }
            else
            {
                this._currentMidiObject = null;
                this.currentMoment = null;
            }
        }
    };

    return publicTrackAPI;

}());
