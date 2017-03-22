/*
 *  copyright 2017 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/TimePointer.js
 */

/*jslint white:true */
/*global _AP,  window,  document */

_AP.namespace('_AP.timePointer');

_AP.timePointer = (function()
{
    "use strict";

    var
    TimePointer = function (originY, height, viewBoxScale, advanceRunningMarker)
    {
        if (!(this instanceof TimePointer))
        {
            return new TimePointer(originY, viewBoxScale, advanceRunningMarker);
        }

        /*** public interface*/
        Object.defineProperty(this, "graphicElement", { value: this._graphicElem(this, height, viewBoxScale), writable: false });
        Object.defineProperty(this, "msPositionInScore", { value: -1, writable: true });

        /*** private interface */
        Object.defineProperty(this, "_originYinViewBox", { value: originY * viewBoxScale, writable: false });
        Object.defineProperty(this, "_viewBoxScale", { value: viewBoxScale, writable: false });
        // The score.advanceRunningMarker(msPosition, systemIndex) function
        Object.defineProperty(this, "_advanceRunningMarker", { value: advanceRunningMarker, writable: false });

        // Will be set to the system's startMarker
        Object.defineProperty(this, "_startMarker", { value: undefined, writable: true });
        // Will be set to the system's runningMarker
        Object.defineProperty(this, "_runningMarker", { value: undefined, writable: true });
        // Will be set to a stand-in for the final barline at the end of the system
        Object.defineProperty(this, "_endOfSystemTimeObject", { value: undefined, writable: true });
        return this;
    },

    // public API
    publicAPI =
    {
        TimePointer: TimePointer
    };

    TimePointer.prototype._graphicElem = function(that, height, viewBoxScale)
    {
        var graphicElement = document.createElementNS("http://www.w3.org/2000/svg", "g"),
        hLine = document.createElementNS("http://www.w3.org/2000/svg", "line"),
        topDiagLine = document.createElementNS("http://www.w3.org/2000/svg", "line"),
        bottomDiagLine = document.createElementNS("http://www.w3.org/2000/svg", "line"),
        vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");

        hLine.setAttribute("x1", (-13.9 * viewBoxScale).toString(10));
        hLine.setAttribute("y1", (10 * viewBoxScale).toString(10));
        hLine.setAttribute("x2", (-1.7 * viewBoxScale).toString(10));
        hLine.setAttribute("y2", (10 * viewBoxScale).toString(10));
        hLine.setAttribute("stroke", "#5555FF");
        hLine.setAttribute("stroke-width", (1.5 * viewBoxScale).toString(10));

        topDiagLine.setAttribute("x1", (-1.6 * viewBoxScale).toString(10));
        topDiagLine.setAttribute("y1", (10 * viewBoxScale).toString(10));
        topDiagLine.setAttribute("x2", (-5.4 * viewBoxScale).toString(10));
        topDiagLine.setAttribute("y2", (6 * viewBoxScale).toString(10));
        topDiagLine.setAttribute("stroke", "#5555FF");
        topDiagLine.setAttribute("stroke-width", (1.5 * viewBoxScale).toString(10));
        topDiagLine.setAttribute("stroke-linecap", "square");

        bottomDiagLine.setAttribute("x1", (-1.6 * viewBoxScale).toString(10));
        bottomDiagLine.setAttribute("y1", (10 * viewBoxScale).toString(10));
        bottomDiagLine.setAttribute("x2", (-5.4 * viewBoxScale).toString(10));
        bottomDiagLine.setAttribute("y2", (14 * viewBoxScale).toString(10));
        bottomDiagLine.setAttribute("stroke", "#5555FF");
        bottomDiagLine.setAttribute("stroke-width", (1.5 * viewBoxScale).toString(10));
        bottomDiagLine.setAttribute("stroke-linecap", "square");

        vLine.setAttribute("x1", "0");
        vLine.setAttribute("y1", "0");
        vLine.setAttribute("x2", "0");
        vLine.setAttribute("y2", (height * viewBoxScale).toString(10));
        vLine.setAttribute("stroke", "#5555FF");
        vLine.setAttribute("stroke-width", (1 * viewBoxScale).toString(10));

        graphicElement.appendChild(hLine);
        graphicElement.appendChild(topDiagLine);
        graphicElement.appendChild(bottomDiagLine);
        graphicElement.appendChild(vLine);

        return graphicElement;
    };

    TimePointer.prototype.init = function(startMarker, runningMarker, endOfSystemTimeObject)
    {
        var currentTimeObject;

        this._startMarker = startMarker;
        this._runningMarker = runningMarker;
        this._endOfSystemTimeObject = endOfSystemTimeObject;

        currentTimeObject = runningMarker.timeObjects[runningMarker.positionIndex];
        this.graphicElement.setAttribute('transform', 'translate(' + (currentTimeObject.alignment * this._viewBoxScale) + ',' + this._originYinViewBox + ')');
        this.msPositionInScore = currentTimeObject.msPositionInScore;        
    };

    TimePointer.prototype.msPerPx = function()
    {
        var
        ms, px,
        leftTimeObject = this._runningMarker.currentTimeObject(),
        rightTimeObject = this._runningMarker.nextTimeObject();

        if(rightTimeObject === undefined)
        {
            rightTimeObject = this._endOfSystemTimeObject;
        }
        ms = rightTimeObject.msPositionInScore - leftTimeObject.msPositionInScore;
        px = rightTimeObject.alignment - leftTimeObject.alignment;

        return (ms / px);
    };

    TimePointer.prototype.advance = function(msIncrement)
    {
        var 
        leftTimeObject, rightTimeObject,
        leftMsPos, rightMsPos, leftAlignment, rightAlignment,
        msOffset, pixelsPerMs, localAlignment,
        systemIndex = this._runningMarker.systemIndex,
        moveToNextSystem = false;

        this.msPositionInScore += msIncrement;

        leftTimeObject = this._runningMarker.currentTimeObject(); 
        rightTimeObject = this._runningMarker.nextTimeObject();
        if(rightTimeObject === undefined)
        {
            rightTimeObject = this._endOfSystemTimeObject;
        }

        while(rightTimeObject.msPositionInScore < this.msPositionInScore)
        {
            if(rightTimeObject === this._endOfSystemTimeObject)
            {               
                // move to next system
                moveToNextSystem = true;
                break;
            }

            this._advanceRunningMarker(rightTimeObject.msPositionInScore, systemIndex);

            leftTimeObject = this._runningMarker.currentTimeObject();
            rightTimeObject = this._runningMarker.nextTimeObject();
            if(rightTimeObject === undefined)
            {
                rightTimeObject = this._endOfSystemTimeObject;
            }
        }

        leftMsPos = leftTimeObject.msPositionInScore;
        leftAlignment = leftTimeObject.alignment;
        rightMsPos = rightTimeObject.msPositionInScore;
        rightAlignment = rightTimeObject.alignment;

        if(moveToNextSystem === false)
        {
            msOffset = this.msPositionInScore - leftMsPos;
            pixelsPerMs = (rightAlignment - leftAlignment) / (rightMsPos - leftMsPos);
            localAlignment = (leftAlignment + (msOffset * pixelsPerMs));
            this.setVisible(true);
        }
        else
        {
            this._runningMarker.setVisible(false);
            this._runningMarker.moveTo(this._startMarker.msPositionInScore);
            localAlignment = this._startMarker.alignment;
            this.setVisible(false);

            systemIndex++;
            this._advanceRunningMarker(rightTimeObject.msPositionInScore, systemIndex);

        }
        this.graphicElement.setAttribute('transform', 'translate(' + localAlignment * this._viewBoxScale + ',' + this._originYinViewBox + ')');
    };

    TimePointer.prototype.setVisible = function(setToVisible)
    {
        if(setToVisible)
        {
            this.graphicElement.setAttribute('opacity', '1');
        }
        else
        {
            this.graphicElement.setAttribute('opacity', '0');
        }
    };

    TimePointer.prototype.now = function()
    {
        return this.msPositionInScore;
    };

    return publicAPI;

} ());

