/*
 *  copyright 2017 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/StartMarker.js
 *  Defines the StartMarker object.
 *  The StartMarker and EndMarker are the objects in a score which determine
 *  where a performance begins and ends.
 *  The RunningMarker is the line which shows the current position in a
 *  performance while it is running. 
 */

_AP.namespace('_AP.startMarker');

_AP.startMarker = (function()
{
    "use strict";

    var 
    // The svgStartMarkerGroup is an svg group with class='startMarker'.
    // It contains an svg line and an svg circle element.
    StartMarker = function(system, systIndex, svgStartMarkerGroup, vbScale)
    {
        if(!(this instanceof StartMarker))
        {
            return new StartMarker(system, systIndex, svgStartMarkerGroup, vbScale);
        }

        this._setAttributes(this, system, systIndex, svgStartMarkerGroup, vbScale);

        this.setVisible(false);

        return this;
    },

    // public API
    publicAPI =
    {
        StartMarker: StartMarker
    };

    // private function (used only in constructor)
    StartMarker.prototype._setAttributes = function(that, system, systIndex, svgStartMarkerGroup, vbScale)
    {
        var p;
        // returns an object having circle, line, viewBoxScale and yCoordinates attributes;
        function getParams(system, svgStartMarkerGroup, vbScale)
        {
            var EXTRA_TOP_AND_BOTTOM = 45, // user html pixels
                CIRCLE_RADIUS = 5, // user html pixels
                GREEN = '#009900',
                top, bottom, params = {};

            function getComponents(params, svgStartMarkerGroup)
            {
                var i, groupChildren = svgStartMarkerGroup.childNodes;

                for(i = 0; i < groupChildren.length; ++i)
                {
                    if(groupChildren[i].nodeName === 'line')
                    {
                        params.line = groupChildren[i];
                    }
                    if(groupChildren[i].nodeName === 'circle')
                    {
                        params.circle = groupChildren[i];
                    }
                }
            }

            getComponents(params, svgStartMarkerGroup);

            params.viewBoxScale = vbScale;

            top = (system.markersTop - EXTRA_TOP_AND_BOTTOM).toString();
            bottom = (system.markersBottom + EXTRA_TOP_AND_BOTTOM).toString();

            params.line.setAttribute('x1', '0');
            params.line.setAttribute('y1', top);
            params.line.setAttribute('x2', '0');
            params.line.setAttribute('y2', bottom);

            params.line.style.strokeWidth = 4; // 1/2 pixel
            params.line.style.stroke = GREEN;

            params.circle.setAttribute('cy', top);
            params.circle.setAttribute('r', (vbScale * CIRCLE_RADIUS).toString());
            params.circle.style.strokeWidth = 0;
            params.circle.style.fill = GREEN;

            params.yCoordinates = {};
            params.yCoordinates.top = Math.round(parseFloat(top) / vbScale);
            params.yCoordinates.bottom = Math.round(parseFloat(bottom) / vbScale);

            return params;
        }

        Object.defineProperty(that, "systemIndex", { value: systIndex, writable: false });

        p = getParams(system, svgStartMarkerGroup, vbScale);
        Object.defineProperty(that, "circle", { value: p.circle, writable: false });
        Object.defineProperty(that, "line", { value: p.line, writable: false });
        Object.defineProperty(that, "viewBoxScale", { value: p.viewBoxScale, writable: false });
        Object.defineProperty(that, "yCoordinates", { value: p.yCoordinates, writable: false });

        Object.defineProperty(that, "alignment", { value: null, writable: true });
        Object.defineProperty(that, "msPositionInScore", { value: 0, writable: true });
    };

    // public functions
    StartMarker.prototype.moveTo = function(timeObject)
    {
        var x = timeObject.alignment * this.viewBoxScale;

        this.alignment = timeObject.alignment;
        this.msPositionInScore = timeObject.msPositionInScore;

        this.line.setAttribute('x1', x.toString());
        this.line.setAttribute('x2', x.toString());
        this.circle.setAttribute('cx', x.toString());
    };

    StartMarker.prototype.setVisible = function(setToVisible)
    {
        if(setToVisible)
        {
            this.line.style.visibility = 'visible';
            this.circle.style.visibility = 'visible';
        }
        else
        {
            this.line.style.visibility = 'hidden';
            this.circle.style.visibility = 'hidden';
        }
    };

    return publicAPI;

} ());

