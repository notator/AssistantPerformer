/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/RunningMarker.js
 *  Defines the RunningMarker object.
 *  The StartMarker and EndMarker are the objects in a score which determine
 *  where a performance begins and ends.
 *  The RunningMarker is the line which shows the current position in a
 *  performance while it is running.
 */

_AP.namespace('_AP.runningMarker');

_AP.runningMarker = (function()
{
    "use strict";

	var

    // The argument is an svg group with id='runningMarker'.
    // The group contains a single svg line.
		RunningMarker = function(system, systemIndexInScore, svgRunningMarkerGroup, vbScale)
    {
        if (!(this instanceof RunningMarker))
        {
			return new RunningMarker(system, systemIndexInScore, svgRunningMarkerGroup, vbScale);
        }

			this._setAttributes(this, system, systemIndexInScore, svgRunningMarkerGroup, vbScale);

        this.setVisible(false);

        return this;
    },

    // public API
    publicAPI =
    {
        RunningMarker: RunningMarker
    };

	RunningMarker.prototype._setAttributes = function(that, system, systemIndexInScore, svgRunningMarkerGroup, vbScale)
    {
        var p;

        // returns an object having line, viewBoxScale and yCoordinates attributes;
        function getParams(system, svgRunningMarkerGroup, vbScale)
        {
            var EXTRA_TOP_AND_BOTTOM = 45, // user html pixels
                top, bottom, color = '#999999', params = {};

            function getLine(params, svgRunningMarkerGroup)
            {
                var i, groupChildren = svgRunningMarkerGroup.childNodes;

                for(i = 0; i < groupChildren.length; ++i)
                {
                    if(groupChildren[i].nodeName === 'line')
                    {
                        params.line = groupChildren[i];
                        break;
                    }
                }
            }

            getLine(params, svgRunningMarkerGroup);

            params.viewBoxScale = vbScale;

            top = (system.markersTop - EXTRA_TOP_AND_BOTTOM).toString();
            bottom = (system.markersBottom + EXTRA_TOP_AND_BOTTOM).toString();

            params.line.setAttribute('x1', '0');
            params.line.setAttribute('y1', top);
            params.line.setAttribute('x2', '0');
            params.line.setAttribute('y2', bottom);

            params.line.style.strokeWidth = 8; // 1 pixel
            params.line.style.stroke = color;

            params.yCoordinates = {};
            params.yCoordinates.top = Math.round(parseFloat(top) / vbScale);
            params.yCoordinates.bottom = Math.round(parseFloat(bottom) / vbScale);

            return params;
        }

        Object.defineProperty(that, "systemIndexInScore", { value: systemIndexInScore, writable: false });

        p = getParams(system, svgRunningMarkerGroup, vbScale);
        Object.defineProperty(that, "line", { value: p.line, writable: false });
        Object.defineProperty(that, "viewBoxScale", { value: p.viewBoxScale, writable: false });
        Object.defineProperty(that, "yCoordinates", { value: p.yCoordinates, writable: false });

        Object.defineProperty(that, "timeObjects", { value: null, writable: true });
        Object.defineProperty(that, "positionIndex", { value: 0, writable: true });
        Object.defineProperty(that, "nextMsPosition", { value: 0, writable: true });
    };

    // The timeObjects array contains one timeObject per msPositionInScore in the system.
    // It is ordered according to each timeObject msPositionInScore.
    // If isLivePerformance === true, the timeObjects are inputObjects from inputVoices,
    // otherwise the timeObjects are midiObjects from outputVoices.
    RunningMarker.prototype.setTimeObjects = function(system, isLivePerformance, trackIsOnArray)
    {
        var
        MidiChord = _AP.midiObject.MidiChord,
        MidiRest = _AP.midiObject.MidiRest,
        InputChordDef = _AP.inputObjectDef.InputChordDef,
        InputRestDef = _AP.inputObjectDef.InputRestDef,
        timeObject;

        function findFollowingTimeObject(system, msPositionInScore, isLivePerformance, trackIsOnArray)
        {
            var nextTimeObject, staff, voice, i, k, voiceIndex, trackIndex = 0,
                    voiceTimeObjects = [];

            for(i = 0; i < system.staves.length; ++i)
            {
                staff = system.staves[i];
                for(voiceIndex = 0; voiceIndex < staff.voices.length; ++voiceIndex)
                {
                    if(staff.isVisible && staff.topLineY !== undefined)
                    {
                        if(trackIsOnArray[trackIndex] === true)
                        {
                            voice = staff.voices[voiceIndex];
                            if(voice.isOutput === true && isLivePerformance === false)
                            {
                                for(k = 0; k < voice.timeObjects.length; ++k)
                                {
                                    if(voice.timeObjects[k].msPositionInScore > msPositionInScore)
                                    {
                                        voiceTimeObjects.push(voice.timeObjects[k]);
                                        break;
                                    }
                                }
                            }
                            else if(voice.isOutput === false && isLivePerformance === true)
                            {
                                for(k = 0; k < voice.timeObjects.length; ++k)
                                {
                                    if(voice.timeObjects[k].msPositionInScore > msPositionInScore)
                                    {
                                        voiceTimeObjects.push(voice.timeObjects[k]);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    trackIndex++;
                }
            }

            // voiceTimeObjects now contains the next timeObject in each active, visible voice.
            // Now find the one having the minimum msPositionInScore.
            nextTimeObject = voiceTimeObjects[0];
            if(voiceTimeObjects.length > 1)
            {
                for(i = 1; i < voiceTimeObjects.length; ++i)
                {
                    if(voiceTimeObjects[i].msPositionInScore < nextTimeObject.msPositionInScore)
                    {
                        nextTimeObject = voiceTimeObjects[i];
                    }
                }
            }
            return nextTimeObject;
        }

        this.timeObjects = [];
        timeObject = findFollowingTimeObject(system, -1, isLivePerformance, trackIsOnArray);
		while (timeObject instanceof MidiChord || timeObject instanceof MidiRest || timeObject instanceof InputChordDef || timeObject instanceof InputRestDef)
		{
			this.timeObjects.push(timeObject);
            timeObject = findFollowingTimeObject(system, timeObject.msPositionInScore, isLivePerformance, trackIsOnArray);
        }
    };

    RunningMarker.prototype.setVisible = function(setToVisible)
    {
        if(setToVisible)
        {
            this.line.style.visibility = 'visible';
        }
        else
        {
            this.line.style.visibility = 'hidden';
        }
    };

    RunningMarker.prototype.moveLineToAlignment = function(alignment)
    {
        var x = alignment * this.viewBoxScale;
        this.line.setAttribute('x1', x.toString());
        this.line.setAttribute('x2', x.toString());
    };

    // This function is necessary after changing systems, where the first position of the system needs to be skipped.
    // msPositionInScore must be in the current system
    RunningMarker.prototype.moveTo = function(msPosInScore)
    {
        var positionIndex = 0, timeObjects = this.timeObjects, timeObject;

        while(positionIndex < (timeObjects.length - 1) && timeObjects[positionIndex].msPositionInScore < msPosInScore)
        {
            positionIndex++;
        }

		timeObject = timeObjects[positionIndex]; 
		this.moveLineToAlignment(timeObject.alignment);
		if (positionIndex === (timeObjects.length - 1))
		{
			this.nextMsPosition = timeObject.msPositionInScore + timeObject.msDurationInScore;
		}
		else
		{
			this.nextMsPosition = timeObjects[positionIndex + 1].msPositionInScore; // may be system's end msPosition
		}
        this.positionIndex = positionIndex;
    };

    RunningMarker.prototype.incrementPosition = function()
    {
        var timeObjects = this.timeObjects;

        this.positionIndex++;

        if(this.positionIndex < (timeObjects.length - 1))
        {
            this.nextMsPosition = timeObjects[this.positionIndex + 1].msPositionInScore;
        }
        else
        {
            this.nextMsPosition = undefined;
        }

        this.moveLineToAlignment(this.timeObjects[this.positionIndex].alignment);
    };

    RunningMarker.prototype.currentTimeObject = function()
    {
        var currentTimeObject;

        if(this.positionIndex < this.timeObjects.length)
        {
            currentTimeObject = this.timeObjects[this.positionIndex];
        }
        return currentTimeObject;
    };

    RunningMarker.prototype.nextTimeObject = function()
    {
        var currentTimeObject;

        if((this.positionIndex + 1) < this.timeObjects.length)
        {
            currentTimeObject = this.timeObjects[this.positionIndex + 1];
        }
        return currentTimeObject;
    };

    return publicAPI;

} ());

