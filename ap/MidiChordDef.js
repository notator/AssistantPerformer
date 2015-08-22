/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/MidiChordDef.js
 *  Public interface contains:
 *     MidiChordDef(midiChordDefNode) // Chord definition constructor. Reads the XML in the midiChordDefNode. 
 *  
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

_AP.namespace('_AP.midiChordDef');

_AP.midiChordDef = (function ()
{
    "use strict";
	var
	numberArray = _AP.utilities.numberArray,

	// Any of the attributes can be undefined.
    // Default values:
    //  hasChordOff = true
    //  pitchWheelDeviation = unchanged (or 2)
    //  minBasicChordMsDuration = 1 (millisecond)
    chordAttributes = function (midiChordDefNode)
    {
        var a,
            attributes = {},
            attributesLength = midiChordDefNode.attributes.length,
            i;

        for (i = 0; i < attributesLength; ++i)
        {
            a = midiChordDefNode.attributes[i];

            // console.log(a.name + " = " + a.value);

            switch (a.name)
            {
                case "hasChordOff":
                    if(a.value === "0")
                    {
                        attributes.hasChordOff = false;
                    }
                    else if(a.value === "1")
                    {
                        attributes.hasChordOff = true;
                    }
                    // if "hasChordOff" does not occur, attributes.hasChordOff will be true
                    break;
                case "pitchWheelDeviation":
                    attributes.pitchWheelDeviation = parseInt(a.value, 10);
                    break;
                case "minBasicChordMsDuration":
                    attributes.minBasicChordMsDuration = parseInt(a.value, 10);
                    break;
                default:
                    throw (">>>>>>>>>> Illegal midiChordDef attribute  <<<<<<<<<<");
            }
        }

        return attributes;
    },

    basicChordsArray = function (midiChordDefNode)
    {
        var basicChordsDef = midiChordDefNode.firstElementChild,
            basicChordDef = basicChordsDef.firstElementChild,
            basicChrdsArray = [];

        function getBasicChord(basicChordDef)
        {
            var attr,
                basicChord = {},
                attributesLength = basicChordDef.attributes.length,
                i;

            for (i = 0; i < attributesLength; ++i)
            {
                attr = basicChordDef.attributes[i];
                // console.log(attr.name + " = " + attr.value);
                switch (attr.name)
                {
                    case "msDuration":
                        basicChord.msDuration = parseInt(attr.value, 10);
                        break;
                    case "bank":
                        basicChord.bank = parseInt(attr.value, 10);
                        break;
                    case "patch":
                        basicChord.patch = parseInt(attr.value, 10);
                        break;
                    case "hasChordOff":
                        if (attr.value === "0")
                        {
                            basicChord.hasChordOff = false;
                        }
                        // is true if undefined
                        break;
                    case "pitches":
                        basicChord.pitches = [];
                        basicChord.pitches = numberArray(attr.value);
                        break;
                    case "velocities":
                        basicChord.velocities = [];
                        basicChord.velocities = numberArray(attr.value);
                        break;
                    default:
                        throw (">>>>>>>>>> Illegal basicChord attribute <<<<<<<<<<");
                }
            }

            // the following properties can be undefined:
            //    bank;
            //    patch;
            //    hasChordOff -- if undefined, is true
            if (basicChord.msDuration === undefined
            || basicChord.pitches === undefined
            || basicChord.velocities === undefined)
            {
                throw ("Error: all basic chords must have msDuration, pitches and velocities");
            }

            if (basicChord.pitches.length !== basicChord.velocities.length)
            {
                throw ("Error: basic chord must have the same number of pitches and velocities");
            }

            return basicChord;
        }

        while (basicChordDef)
        {
            try
            {
                basicChrdsArray.push(getBasicChord(basicChordDef));
                basicChordDef = basicChordDef.nextElementSibling;
            }
            catch (ex)
            {
                console.log(ex);
            }
        }
        return basicChrdsArray;
    },

    // Any and all of the returned sliders properties can be undefined
    sliders = function (midiChordDefNode)
    {
        var sliders = {},
            attr,
            attributesLength,
            slidersDef = midiChordDefNode.lastElementChild,
            i;

        if (slidersDef !== null)
        {
            attributesLength = slidersDef.attributes.length;
            for (i = 0; i < attributesLength; ++i)
            {
                attr = slidersDef.attributes[i];
                // console.log(attr.name + " = " + attr.value);

                switch (attr.name)
                {
                    case "pitchWheel":
                        sliders.pitchWheel = [];
                        sliders.pitchWheel = numberArray(attr.value);
                        break;
                    case "pan":
                        sliders.pan = [];
                        sliders.pan = numberArray(attr.value);
                        break;
                    case "modulationWheel":
                        sliders.modulationWheel = [];
                        sliders.modulationWheel = numberArray(attr.value);
                        break;
                    case "expressionSlider":
                        sliders.expressionSlider = [];
                        sliders.expressionSlider = numberArray(attr.value);
                        break;
                    default:
                        throw (">>>>>>>>>> Illegal slider <<<<<<<<<<");
                }
            }
        }
        return sliders;
    },

    // MidiChordDef constructor
    // The midiChordDef contains the midiChordDef information from the XML in a form that is easier to program with.
    // The MidiChordDef has the following fields:
    //    midiChordDef.attributes
    //    midiChordDef.basicChordsArray[]
    //    midiChordDef.sliders
    //
    // Each basicChord in the midiChordDef.basicChordsArray[] has the following fields:
    //       basicChord.msDuration (compulsory int)
    //       basicChord.bank (optional int)
    //       basicChord.patch (optional int -- compulsory, if bank is defined)
    //       basicChord.hasChordOff (optional boolean -- true if undefined)
    //       basicChord.pitches[] (compulsory int array)
    //       basicChord.velocities (compulsory int array -- pitches and velocities have the same length)
    //
    // midiChordDef.sliders (which are all either undefined, or numberArrays) can be:
    //       midiChordDef.sliders.pitchWheel[]
    //       midiChordDef.sliders.pan[]
    //       midiChordDef.sliders.modulationWheel[];
    //       midiChordDef.sliders.expressionSlider[];
    MidiChordDef = function (midiChordDefNode)
    {
        if (!(this instanceof MidiChordDef))
        {
            return new MidiChordDef(midiChordDefNode);
        }

        this.attributes = chordAttributes(midiChordDefNode);
        this.basicChordsArray = basicChordsArray(midiChordDefNode);
        this.sliders = sliders(midiChordDefNode);

        return this;
    },

    // public API
    publicAPI =
    {
        // public MidiChordDef(midiChordDefNode) constructor.
        MidiChordDef: MidiChordDef
    };

    return publicAPI;

} ());

