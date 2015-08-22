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
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

_AP.namespace('_AP.utilities');

_AP.utilities = (function()
{
    "use strict";

    // begin var
    var
    INPUT_ERROR_COLOR = _AP.constants.INPUT_ERROR_COLOR,
	// The argument is a string containing a list of integers separated by single spaces
    // This function returns the corresponding array of numbers.
    numberArray = function(numberList)
    {
    	var stringArray = numberList.split(' '),
            len = stringArray.length,
            numArray = [],
            i;

    	for(i = 0; i < len; ++i)
    	{
    		numArray.push(parseInt(stringArray[i], 10));
    	}
    	return numArray;
    },
    // The numberInput argument is an html5 input element of type 'number'.
    // If the element's value is empty, not a number, less than min or greater than max,
    // its background colour is set to INPUT_ERROR_COLOR and it is given a true boolean jiError attribute.
	// Otherwise, the background colour is set to white and jiError is set to null (for garbage collector).
    checkFloatRange = function (numberInput, min, max)
    {
        var floatValue = parseFloat(numberInput.value);
        if(isNaN(floatValue) || floatValue < min || floatValue > max || numberInput.value === "")
        {
            numberInput.style.backgroundColor = INPUT_ERROR_COLOR;
            numberInput.jiError = true;
        }
        else
        {
            numberInput.style.backgroundColor = "#FFFFFF";
            numberInput.jiError = null;
        }
    },

    // The numberInput argument is an html5 input element of type 'number'.
    // If the element's value is empty, not an integer, less than min or greater than max,
    // its background colour is set to INPUT_ERROR_COLOR and it is given a true boolean jiError attribute.
	// Otherwise, the background colour is set to white and jiError is set to null (for garbage collector).
    checkIntRange = function(numberInput, min, max)
    {
        var
        intValue = parseInt(numberInput.value, 10),
        floatValue = parseFloat(numberInput.value);

        if(isNaN(intValue) || intValue < min || intValue > max || intValue !== floatValue || numberInput.value === "")
        {
            numberInput.style.backgroundColor = INPUT_ERROR_COLOR;
            numberInput.jiError = true;
        }
        else
        {
            numberInput.style.backgroundColor = "#FFFFFF";
            numberInput.jiError = null;
        }
    },

    // If the numberInput's int value === defaultIntValue, its color is set to blue,
    // otherwise its color is set to black.
    setDefaultValueToBlue = function(numberInput, defaultIntValue)
    {
        if(parseInt(numberInput.value) === defaultIntValue)
        {
            numberInput.style.color = "#8888FF"; // help colour
        }
        else
        {
            numberInput.style.color = "#000000";
        }
    },

    // Returns an array of nTracks ints corresponding to the attrName in the optsString.
    // If optsString is null or the attrName does not exist in optsString,
    // an array containing nTracks copies of the defaultIntValue is returned.
    // If the attrName exists, its corresponding value must be a string of nTracks integers
    // each separated by a ',' character (otherwise an exception is thrown).
    // The attrName argument must end with a '=' character.
    intArrayFromAttribute = function(nTracks, optsString, attrName, defaultIntValue)
    {
        var index,
            valStr,
            rvalString,
            rIntArray;

        function defaultArray(nTracks, defaultIntValue)
        {
            var i, rval = [];
            for(i = 0; i < nTracks; ++i)
            {
                rval.push(defaultIntValue);
            }
            return rval;
        }

        function stringToIntArray(str)
        {
            var strArray = str.split(','),
                intArray = [],
                i, num;

            for(i = 0; i < strArray.length; ++i)
            {
                num = parseInt(strArray[i], 10);
                if(isNaN(num) === false)
                {
                    intArray.push(num);
                }
                else
                {
                    throw "Error parsing integer.";
                }
            }
            return intArray;
        }

        if(attrName[attrName.length - 1] !== '=')
        {
            throw "The attrName argument must end with a '=' character.";
        }

        if(optsString === null)
        {
            rIntArray = defaultArray(nTracks, defaultIntValue);
        }
        else
        {
            index = optsString.search(attrName);
            if(index !== -1)
            {
                valStr = optsString.substr(index + attrName.length + 1);
                index = valStr.search("\"");
                rvalString = valStr.substr(0, index);
                rIntArray = stringToIntArray(rvalString);
            }
            else
            {
                rIntArray = defaultArray(nTracks, defaultIntValue);
            }
        }

        if(rIntArray === undefined || rIntArray.length !== nTracks)
        {
            throw "Error getting int array attribute.";
        }

        return rIntArray;
    },

    publicAPI =
    {
    	numberArray: numberArray,
        checkFloatRange: checkFloatRange,
        checkIntRange: checkIntRange,
        setDefaultValueToBlue: setDefaultValueToBlue,
        intArrayFromAttribute: intArrayFromAttribute
    };
    // end var

    return publicAPI;

}());
