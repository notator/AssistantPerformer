/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiFile.js
 *  The JI_NAMESPACE.file namespace containing the function
 *       getSubDocument(embedded_element)
 *  This function returns the xml of the given embedded_element.
 *  
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */

JI_NAMESPACE.namespace('JI_NAMESPACE.file');

JI_NAMESPACE.file = (function ()
{
    "use strict";
    // returns the xml of the given embedded_element
    var getSubDocument = function (embedded_element)
    {
        var subdoc;

        if (embedded_element.contentDocument)
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
            catch (e){}
        }
        return subdoc;
    },

    // public API
    publicAPI =
    {
        // returns the xml of the given embedded_element
        // for examples of its use, see jiPalettes.js and jiMidiControl.js.
        getSubDocument: getSubDocument
    };

    return publicAPI;

} ());

