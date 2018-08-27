/*
 *  copyright 2017 James Ingram
 *  https://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/EndMarker.js
 *  Defines the EndMarker object.
 *  The StartMarker and EndMarker are the objects in a score which determine
 *  where a performance begins and ends.
 *  The RunningMarker is the line which shows the current position in a
 *  performance while it is running.  
 */

_AP.namespace('_AP.endMarker');

_AP.endMarker = (function()
{
    "use strict";

    var
    // The svgEndMarkerGroup is an svg group with id='endMarker'.
    // It contains an svg line and an svg rect element.
		EndMarker = function(system, systemIndexInScore, svgEndMarkerGroup, vbScale)
    {
        if(!(this instanceof EndMarker))
        {
			return new EndMarker(system, systemIndexInScore, svgEndMarkerGroup, vbScale);
        }

			this._setAttributes(this, system, systemIndexInScore, svgEndMarkerGroup, vbScale);

        this.setVisible(false);

        return this;
    },

    // public API
    publicAPI =
    {
        EndMarker: EndMarker
    };

	EndMarker.prototype._setAttributes = function(that, system, systemIndexInScore, svgEndMarkerGroup, vbScale)
    {
        var p;

        // returns an object having rect, line, halfRectWidth and viewBoxScale attributes;
        function getParams(system, svgEndMarkerGroup, vbScale)
        {
            var EXTRA_TOP_AND_BOTTOM = 45, // user html pixels
                RECT_WIDTH_AND_HEIGHT = 8, // user html pixels
                RED = '#EE0000',
                top, bottom, rectX, rectY, widthHeight,
                params = {};

            function getComponents(params, svgEndMarkerGroup)
            {
                var i, groupChildren = svgEndMarkerGroup.childNodes;

                for(i = 0; i < groupChildren.length; ++i)
                {
                    if(groupChildren[i].nodeName === 'line')
                    {
                        params.line = groupChildren[i];
                    }
                    if(groupChildren[i].nodeName === 'rect')
                    {
                        params.rect = groupChildren[i];
                    }
                }
            }

            getComponents(params, svgEndMarkerGroup);

            params.viewBoxScale = vbScale;

            top = (system.markersTop - EXTRA_TOP_AND_BOTTOM).toString();
            bottom = (system.markersBottom + EXTRA_TOP_AND_BOTTOM).toString();

            rectX = (vbScale * (-RECT_WIDTH_AND_HEIGHT / 2)).toString(10);
            rectY = (top - (vbScale * (RECT_WIDTH_AND_HEIGHT / 2))).toString(10);

            params.halfRectWidth = (vbScale * RECT_WIDTH_AND_HEIGHT) / 2;
            widthHeight = (vbScale * RECT_WIDTH_AND_HEIGHT).toString(10);

            params.line.setAttribute('x1', '0');
            params.line.setAttribute('y1', top);
            params.line.setAttribute('x2', '0');
            params.line.setAttribute('y2', bottom);

            params.line.style.strokeWidth = 4;
            params.line.style.stroke = RED;

            params.rect.setAttribute('x', rectX);
            params.rect.setAttribute('y', rectY);
            params.rect.setAttribute('width', widthHeight);
            params.rect.setAttribute('height', widthHeight);

            params.rect.style.strokeWidth = 0;
            params.rect.style.fill = RED;

            return params;
        }

        Object.defineProperty(that, "systemIndexInScore", { value: systemIndexInScore, writable: false });

        p = getParams(system, svgEndMarkerGroup, vbScale);
        Object.defineProperty(that, "rect", { value: p.rect, writable: false });
        Object.defineProperty(that, "halfRectWidth", { value: p.halfRectWidth, writable: false });
        Object.defineProperty(that, "line", { value: p.line, writable: false });
        Object.defineProperty(that, "viewBoxScale", { value: p.viewBoxScale, writable: false });

        Object.defineProperty(that, "msPositionInScore", { value: 0, writable: true });
    };
    
    // the argument's alignment is in user html pixels
    EndMarker.prototype.moveTo = function(timeObject)
    {
        var x = timeObject.alignment * this.viewBoxScale;

        this.msPositionInScore = timeObject.msPositionInScore;

        this.line.setAttribute('x1', x.toString());
        this.line.setAttribute('x2', x.toString());
        this.rect.setAttribute('x', (x - this.halfRectWidth).toString());
    };
    
    EndMarker.prototype.setVisible = function (setToVisible)
    {
        if (setToVisible)
        {
            this.rect.style.visibility = 'visible';
            this.line.style.visibility = 'visible';
        }
        else
        {
            this.rect.style.visibility = 'hidden';
            this.line.style.visibility = 'hidden';
        }
    };

    return publicAPI;

} ());

