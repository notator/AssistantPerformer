
/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/SVG.js
 *
 *  Workaround to avoid throwing cross-protocol exceptions when accessing SVG files
 *  from an HTML environment.
 *  This file defines an onLoad() function which is called by the first SVG page of
 *  each score when it has loaded.
 *  onLoad() sets a local pointer to the getSVGDocument(embedded_element) function
 *  defined here.
 *  getSVGDocument(embedded_element) is a function which returns the xml of the
 *  embedded_element (an .svg page), and can be called from .html without throwing
 *  a cross-protocol exception.
 */
 
/*jslint bitwise: false, nomen: false, plusplus: false, white: true */

// Returns the xml of the embedded_element (which is a reference to an SVG file).
function getSVGDocument(embedded_element)
{
    var subdoc;

    if(embedded_element.contentDocument)
    {
        subdoc = embedded_element.contentDocument;
    }
    else
    {
        subdoc = null;
        try
        {
            subdoc = embedded_element.getSVGDocument();
        }
        catch(e) { }
    }
    return subdoc;
}

// This function is called by the first (SVG) page in each score, when it has loaded.
// It calls a function in the environment [_JI_SVGLoaded()], which adds a pointer to
// getSVGDocument(embedded_element) to a local 'svg' object in that environment.
//
// svg.getSVGDocument(embedded_element) can then be called from the .html environment,
// and it returns the embedded_element's xml without throwing a cross-protocol exception.
function onLoad()
{
    "use strict";

    // _JI_SVGLoaded() is defined in init() in ap/Controls.js
    // It adds the argument function to a local 'svg' object inside Controls.
    if(window.parent._JI_SVGLoaded)
    {
        window.parent._JI_SVGLoaded(getSVGDocument);
    }
    else
    {
        alert("didn't find _JI_SVGLoaded() in enclosing window!");
    }
}