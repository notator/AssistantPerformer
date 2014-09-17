/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/Markers.js
 *  Defines the StartMarker, EndMarker and RunningMarker objects.
 *  The StartMarker and EndMarker are the objects in a score which determine
 *  where a performance begins and ends.
 *  The RunningMarker is the line which shows the current position in a
 *  performance while it is running.
 *  
 */

/*jslint bitwise: false, nomen: true, plusplus: true, white: true */

_AP.namespace('_AP.markers');

_AP.markers = (function ()
{
    "use strict";

    var EXTRA_TOP_AND_BOTTOM = 45, // user html pixels
        ELLIPSE_RADIUS = 5, // user html pixels
        RECT_WIDTH_AND_HEIGHT = 8, // user html pixels

    // markers are used to determine the start and end points of a performance
    // when playing a MIDI file

    // The argument is an svg group with class='startMarker'.
    // It contains an svg line and an svg ellipse element.
    // This constructor simply saves pointers to the line and ellipse.
    // Their parameters are set later, using the setParameters() function,
    // when the system parameters are known.
    StartMarker = function (svgStartMarkerGroup, vbOriginY, vbScale)
    {
        if (!(this instanceof StartMarker))
        {
            return new StartMarker();
        }

        var 
        i, groupChildren,
        viewBoxOriginY, viewBoxScale,
        line,
        ellipse,
        color = '#00BB00', disabledColor = '#AAFFAA',
        sysIndex, timObject,
        millisecondPosition, yCoordinates = {},

        moveTo = function (tObject)
        {
            var x = tObject.alignmentX;

            timObject = tObject;

            millisecondPosition = tObject.msPosition;

            x *= viewBoxScale;
            line.setAttribute('x1', x.toString());
            line.setAttribute('x2', x.toString());
            ellipse.setAttribute('cx', x.toString());
        },

        msPosition = function ()
        {
            return millisecondPosition;
        },

        setParameters = function (system, systIndex)
        {
            var topY, bottomY;

            topY = (viewBoxScale * (system.topLineY - viewBoxOriginY - EXTRA_TOP_AND_BOTTOM)).toString();
            bottomY = (viewBoxScale * (system.bottomLineY - viewBoxOriginY + EXTRA_TOP_AND_BOTTOM)).toString();

            line.setAttribute('x1', '0');
            line.setAttribute('y1', topY);
            line.setAttribute('x2', '0');
            line.setAttribute('y2', bottomY);
            line.setAttribute('stroke-width', '4'); // 1/2 pixel
            line.setAttribute('stroke', color);

            ellipse.setAttribute('cy', topY);
            ellipse.setAttribute('rx', (viewBoxScale * ELLIPSE_RADIUS).toString());
            ellipse.setAttribute('ry', (viewBoxScale * ELLIPSE_RADIUS).toString());
            ellipse.setAttribute('stroke-width', '0');
            ellipse.setAttribute('fill', color);

            yCoordinates.top = Math.round(parseFloat(topY) / vbScale) + viewBoxOriginY;
            yCoordinates.bottom = Math.round(parseFloat(bottomY) / vbScale) + viewBoxOriginY;

            sysIndex = systIndex;
            moveTo(system.staves[0].voices[0].timeObjects[0]);
        },

        systemIndex = function ()
        {
            return sysIndex;
        },

        timeObject = function ()
        {
            return timObject;
        },

        setEnabledColor = function (setToEnabledColor)
        {
            if (setToEnabledColor)
            {
                line.setAttribute('stroke', color);
                ellipse.setAttribute('fill', color);
            }
            else
            {
                line.setAttribute('stroke', disabledColor);
                ellipse.setAttribute('fill', disabledColor);
            }
        },

        setVisible = function (setToVisible)
        {
            if (setToVisible)
            {
                line.setAttribute('visibility', 'visible');
                ellipse.setAttribute('visibility', 'visible');
            }
            else
            {
                line.setAttribute('visibility', 'hidden');
                ellipse.setAttribute('visibility', 'hidden');
            }
        },

        getYCoordinates = function ()
        {
            var val = {};
            val.top = yCoordinates.top;
            val.bottom = yCoordinates.bottom;
            return val;
        };

        viewBoxOriginY = vbOriginY;
        viewBoxScale = vbScale;

        groupChildren = svgStartMarkerGroup.childNodes;
        for (i = 0; i < groupChildren.length; ++i)
        {
            if (groupChildren[i].nodeName === 'line')
            {
                line = groupChildren[i];
            }
            if (groupChildren[i].nodeName === 'ellipse')
            {
                ellipse = groupChildren[i];
            }
        }

        setVisible(false);

        this.setParameters = setParameters;
        this.systemIndex = systemIndex;
        this.timeObject = timeObject;
        this.msPosition = msPosition;
        this.moveTo = moveTo;
        this.setVisible = setVisible;
        this.setEnabledColor = setEnabledColor;
        this.getYCoordinates = getYCoordinates;

        return this;
    },

    // The argument is an svg group with class='endMarker'.
    // It contains an svg line and an svg rect element.
    // This constructor simply saves pointers to the line and rect.
    // Their parameters are set later, using the setParameters() function,
    // when the system parameters are known.
    EndMarker = function (svgEndMarkerGroup, vbOriginY, vbScale)
    {
        if (!(this instanceof EndMarker))
        {
            return new EndMarker();
        }

        var 
        i, groupChildren,
        viewBoxOriginY, viewBoxScale,
        line,
        rect,
        halfRectWidth,
        color = '#EE0000', disabledColor = '#FFC8C8',
        millisecondPosition,

        setParameters = function (system)
        {
            var topY, bottomY, rectX, rectY;

            topY = (viewBoxScale * (system.topLineY - viewBoxOriginY - EXTRA_TOP_AND_BOTTOM)).toString();
            bottomY = (viewBoxScale * (system.bottomLineY - viewBoxOriginY + EXTRA_TOP_AND_BOTTOM)).toString();
            rectX = (viewBoxScale * (-RECT_WIDTH_AND_HEIGHT / 2)).toString();
            rectY = (topY - (viewBoxScale * (RECT_WIDTH_AND_HEIGHT / 2))).toString();

            line.setAttribute('x1', '0');
            line.setAttribute('y1', topY);
            line.setAttribute('x2', '0');
            line.setAttribute('y2', bottomY);
            line.setAttribute('stroke-width', '4'); // 1/2 pixel
            line.setAttribute('stroke', color);

            rect.setAttribute('x', rectX);
            rect.setAttribute('y', rectY);
            rect.setAttribute('width', (viewBoxScale * RECT_WIDTH_AND_HEIGHT).toString());
            rect.setAttribute('height', (viewBoxScale * RECT_WIDTH_AND_HEIGHT).toString());
            halfRectWidth = (viewBoxScale * RECT_WIDTH_AND_HEIGHT) / 2;
            rect.setAttribute('stroke-width', '0');
            rect.setAttribute('fill', color);
        },

        // the argument's alignmentX is in user html pixels
        moveTo = function (timeObject)
        {
            var x = timeObject.alignmentX;

            millisecondPosition = timeObject.msPosition;

            x *= viewBoxScale;
            line.setAttribute('x1', x.toString());
            line.setAttribute('x2', x.toString());
            rect.setAttribute('x', (x - halfRectWidth).toString());
        },

        msPosition = function ()
        {
            return millisecondPosition;
        },

        setEnabledColor = function (setToEnabledColor)
        {
            if (setToEnabledColor)
            {
                line.setAttribute('stroke', color);
                rect.setAttribute('fill', color);
            }
            else
            {
                line.setAttribute('stroke', disabledColor);
                rect.setAttribute('fill', disabledColor);
            }
        },

        setVisible = function (setToVisible)
        {
            if (setToVisible)
            {
                line.setAttribute('visibility', 'visible');
                rect.setAttribute('visibility', 'visible');
            }
            else
            {
                line.setAttribute('visibility', 'hidden');
                rect.setAttribute('visibility', 'hidden');
            }
        };

        viewBoxOriginY = vbOriginY;
        viewBoxScale = vbScale;

        groupChildren = svgEndMarkerGroup.childNodes;
        for (i = 0; i < groupChildren.length; ++i)
        {
            if (groupChildren[i].nodeName === 'line')
            {
                line = groupChildren[i];
            }
            if (groupChildren[i].nodeName === 'rect')
            {
                rect = groupChildren[i];
            }
        }

        setVisible(false);

        this.setParameters = setParameters;
        this.moveTo = moveTo;
        this.msPosition = msPosition;
        this.setVisible = setVisible;
        this.setEnabledColor = setEnabledColor;

        return this;
    },

    // The argument is an svg group with class='runningMarker'.
    // The group contains a single svg line.
    // This constructor simply saves pointers to the line.
    // Its parameters are set later, using the setParameters() function,
    // when the system parameters are known.
    RunningMarker = function (svgStartMarkerGroup, vbOriginY, vbScale)
    {
        if (!(this instanceof RunningMarker))
        {
            return new RunningMarker();
        }

        var 
        // private variables ***********************************
        i, groupChildren, viewBoxOriginY, viewBoxScale,
        line, timeObjects, positionIndex,
        nextMillisecondPosition,
        sysIndex, yCoordinates = {},

        moveLineToAlignmentX = function (alignmentX)
        {
            var x = alignmentX * viewBoxScale;
            line.setAttribute('x1', x.toString());
            line.setAttribute('x2', x.toString());
        },

        setNextMsPosition = function (currentIndex)
        {
            if (currentIndex < (timeObjects.length - 1))
            {
                nextMillisecondPosition = timeObjects[currentIndex + 1].msPosition;
            }
            else
            {
                nextMillisecondPosition = undefined;
            }
        },

        // The startMarker argument is in the same system as this runningMarker
        // If the startMarker is on the system's end barline, nextMsPosition is set to undefined.
        // (The current runningMarker is changed to the following system's runningMarker,
        // if the sequencer's msTimeStamp > system.endMsPosition, so the undefined value for
        // the runningMarker.nextMsPosition should never be accessed.
        moveToStartMarker = function (startMarker)
        {
            var i;

            for (i = 0; i < timeObjects.length; ++i)
            {
                if (startMarker.timeObject().msPosition === timeObjects[i].msPosition)
                {
                    positionIndex = i;
                    setNextMsPosition(i);
                    break;
                }
            }
            moveLineToAlignmentX(startMarker.timeObject().alignmentX);
        },

        moveToStartOfSystem = function ()
        {
            positionIndex = 0;
            moveLineToAlignmentX(timeObjects[positionIndex].alignmentX);
            nextMillisecondPosition = timeObjects[positionIndex + 1].msPosition; // may be system's end barline
        },

        incrementPosition = function ()
        {
            //console.log("runningMarker: msPos before increment=%i, after increment=%i", timeObjects[positionIndex].msPosition, timeObjects[positionIndex + 1].msPosition);
            positionIndex++;
            setNextMsPosition(positionIndex);
            moveLineToAlignmentX(timeObjects[positionIndex].alignmentX);
        },

        systemIndex = function ()
        {
            return sysIndex;
        },

        nextMsPosition = function ()
        {
            return nextMillisecondPosition;
        },

        // The timeObjects array contains one timeObject per msPosition in the system.
        // It is ordered according to each timeObject msPosition.
        // trackIsOn is a callback which returns the on/of status of its trackIndex argument.
        // If trackIsOn is null, then all tracks are on by default.
		setTimeObjects = function (system, trackIsOn)
		{
			var timeObject,
				trackTimeObjectIndices = [];

			function initTrackTimeObjectIndices(system)
			{
				var i, j, staff;
				for(i = 0; i < system.staves.length; ++i)
				{
					staff = system.staves[i];
					for(j = 0; j < staff.voices.length; ++j)
					{
						trackTimeObjectIndices.push(0);
					}
				}
			}

			function findNextTimeObject(system, trackIsOn)
		    {
				var nextTimeObject, staff, track, i, j,
					trackIndex = 0,
					minPos = Number.MAX_VALUE;

				for(i = 0; i < system.staves.length; ++i)
				{
					staff = system.staves[i];
					for(j = 0; j < staff.voices.length; ++j)
					{
						if(trackIsOn === null || trackIsOn(trackIndex))
						{
							track = staff.voices[j];
							if(track.timeObjects[trackTimeObjectIndices[trackIndex]].msPosition < minPos)
							{
								nextTimeObject = track.timeObjects[trackTimeObjectIndices[trackIndex]];
								minPos = nextTimeObject.msPosition;
							}
						}
						++trackIndex;
					}
				}

				// nextTimeObject is the earliest in any voice (=track)
				// Now increment the indices for all the tracks currently at this position.
				trackIndex = 0;
				for(i = 0; i < system.staves.length; ++i)
				{
					staff = system.staves[i];
					for(j = 0; j < staff.voices.length; ++j)
					{
						if(trackIsOn === null || trackIsOn(trackIndex))
						{
							track = staff.voices[j];
							if(track.timeObjects[trackTimeObjectIndices[trackIndex]].msPosition === minPos)
							{
								trackTimeObjectIndices[trackIndex]++;
							}
						}
						++trackIndex;
					}
				}

		        return nextTimeObject;
		    }

		    timeObjects = [];
		    timeObject = {};
		    timeObject.msPosition = -1;

		    initTrackTimeObjectIndices(system);

		    while(timeObject.msPosition < system.endMsPosition)
		    {
		        timeObject = findNextTimeObject(system, trackIsOn);
		        timeObjects.push(timeObject);
		    }
		},


        setParameters = function (system, systIndex)
        {
            var topY, bottomY, color = '#999999';

            sysIndex = systIndex;

            topY = (viewBoxScale * (system.topLineY - viewBoxOriginY - EXTRA_TOP_AND_BOTTOM)).toString();
            bottomY = (viewBoxScale * (system.bottomLineY - viewBoxOriginY + EXTRA_TOP_AND_BOTTOM)).toString();

            line.setAttribute('x1', '0');
            line.setAttribute('y1', topY);
            line.setAttribute('x2', '0');
            line.setAttribute('y2', bottomY);
            line.setAttribute('stroke-width', '8'); // 1 pixel
            line.setAttribute('stroke', color);

            yCoordinates.top = Math.round(parseFloat(topY) / vbScale) + viewBoxOriginY;
            yCoordinates.bottom = Math.round(parseFloat(bottomY) / vbScale) + viewBoxOriginY;

            setTimeObjects(system, null);

            moveToStartOfSystem();
        },

        setVisible = function (setToVisible)
        {
            if (setToVisible)
            {
                line.setAttribute('visibility', 'visible');
            }
            else
            {
                line.setAttribute('visibility', 'hidden');
            }
        },

        getYCoordinates = function ()
        {
            var val = {};
            val.top = yCoordinates.top;
            val.bottom = yCoordinates.bottom;
            return val;
        };

        viewBoxOriginY = vbOriginY;
        viewBoxScale = vbScale;

        groupChildren = svgStartMarkerGroup.childNodes;
        for (i = 0; i < groupChildren.length; ++i)
        {
            if (groupChildren[i].nodeName === 'line')
            {
                line = groupChildren[i];
            }
        }

        setVisible(false);

        // public functions interface
        this.setParameters = setParameters;
        this.setTimeObjects = setTimeObjects;
        this.setVisible = setVisible;
        this.systemIndex = systemIndex;
        this.nextMsPosition = nextMsPosition;
        this.moveToStartOfSystem = moveToStartOfSystem;
        this.moveToStartMarker = moveToStartMarker;
        this.incrementPosition = incrementPosition;
        this.getYCoordinates = getYCoordinates;

        return this;
    },

    // public API
    publicAPI =
    {
        StartMarker: StartMarker,
        RunningMarker: RunningMarker,
        EndMarker: EndMarker
    };

    return publicAPI;

} ());

