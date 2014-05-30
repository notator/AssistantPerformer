/*
*  copyright 2014 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/utilities.js
*  The _AP.utilities namespace which defines generally useful functions.   
*/

/*jslint bitwise: true, nomen: true, plusplus: true, white: true */

_AP.namespace('_AP.utilities');

_AP.utilities = (function()
{
    "use strict";

    // begin var
    var
    INPUT_ERROR_COLOR = _AP.constants.INPUT_ERROR_COLOR,
    // The numberInput argument is an html5 input element of type 'number'.
    // If the element's value is empty, not a number, less than min or greater than max,
    // its background colour is set to INPUT_ERROR_COLOR.
    checkFloatRange = function (numberInput, min, max)
    {
        var floatValue = parseFloat(numberInput.value);
        if(floatValue < min || floatValue >  max || numberInput.value === "")
        {
            numberInput.style.backgroundColor = INPUT_ERROR_COLOR;
        }
        else
        {
            numberInput.style.backgroundColor = "#FFFFFF";
        }
    },

    // The numberInput argument is an html5 input element of type 'number'.
    // If the element's value is empty, not an integer, less than min or greater than max,
    // its background colour is set to INPUT_ERROR_COLOR.
    checkIntRange = function(numberInput, min, max)
    {
        var
        intValue = parseInt(numberInput.value),
        floatValue = parseFloat(numberInput.value);

        if(intValue < min || intValue > max || intValue !== floatValue || numberInput.value === "")
        {
            numberInput.style.backgroundColor = INPUT_ERROR_COLOR;
        }
        else
        {
            numberInput.style.backgroundColor = "#FFFFFF";
        }
    },

    publicAPI =
    {
        checkFloatRange: checkFloatRange,
        checkIntRange: checkIntRange
    };
    // end var

    return publicAPI;

}(document));
