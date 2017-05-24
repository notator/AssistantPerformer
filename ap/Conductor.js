/*
 *  copyright 2017 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/Conductor.js
 *  The Conductor handles mousemove events in the conducting layer.  
 */

_AP.namespace('_AP.conductor');

_AP.conductor = (function()
{
    "use strict";

    var

    Conductor = function(startPlayingFunction)
    {
        if(!(this instanceof Conductor))
        {
            return new Conductor(startPlayingFunction);
        }

        /*** The prototype functions are the public interface.*/

        /*** private interface */
        Object.defineProperty(this, "_startPlaying", { value: startPlayingFunction, writable: false });
        // The _speed is the value of the speed control when the set conducting button is clicked.
        // It is the ratio between the total distance travelled by the conductor's cursor and the elapsed time
        // (according to msPositionInScore) since the beginning of the performance.
        Object.defineProperty(this, "_speed", { value: -1, writable: true });
        Object.defineProperty(this, "_timePointer", { value: undefined, writable: true });
        Object.defineProperty(this, "_prevX", { value: -1, writable: true });
        Object.defineProperty(this, "_prevY", { value: -1, writable: true });

        return this;
    },

    // public API
    publicAPI =
    {
        Conductor : Conductor
    };

    // mousemove handler
    Conductor.prototype.conduct = function(e)
    {
        var
        pixelDistance, milliseconds,
        dx, dy;

        if(this._prevX < 0)
        {
            this._prevX = e.clientX;
            this._prevY = e.clientY;
            this._startPlaying(false);
        }
        else
        {
            dx = this._prevX - e.clientX;
            dy = this._prevY - e.clientY;

            this._prevX = e.clientX;
            this._prevY = e.clientY;

            pixelDistance = Math.sqrt((dx * dx) + (dy * dy));

            milliseconds = pixelDistance * this._timePointer.msPerPx() * this._speed;

            this._timePointer.advance(milliseconds);
        }
    };

    Conductor.prototype.setSpeed = function(speed)
    {
        this._speed = speed;
    };

    Conductor.prototype.setTimePointer = function(timePointer)
    {
        if(this._timePointer !== undefined)
        {
            this._timePointer.setVisible(false);
        }

        this._timePointer = timePointer;
        if(timePointer !== undefined)
        {
            this._timePointer.setVisible(true);
            this._prevX = -1;
        }
    };

    Conductor.prototype.now = function()
    {
        return this._timePointer.now();
    };

    return publicAPI;

} ());

