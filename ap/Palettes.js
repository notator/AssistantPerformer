/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/Palettes.js
 *  Public interface contains:
 *     Palettes() // constructor. Gets the palettes defined in a "midiDefs" element in the first
 *                // SVG page embedded in the HTML. Palettes is an array of palette. Each palette
 *                // is an array of ChordDef and RestDef. Note that RestDefs are placeholders in
 *                // palettes. They are never actually referred to outside this namespace, so
 *                // their definition is not public.
 *     ChordDef(chordDefNode) // Chord definition constructor. Reads the XML in the chordDefNode. 
 *  
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */

_AP.namespace('_AP.palettes');

_AP.palettes = (function (document)
{
    "use strict";
    // begin var
    // module dependencies (see Javascript Patterns p.98)
    var
    // private properties (see Javascript Patterns p.98)
    // private methods (see Javascript Patterns p.98)
    paletteNumber = function (id)
    {
        var str = id;
        str = id.replace("palette", "");
        return parseInt(str, 10);
    },

    // The argument is a string containing a list of integers separated by single spaces
    // This function returns the corresponding array of numbers.
    numberArray = function (numberList)
    {
        var stringArray = numberList.split(' '),
            len = stringArray.length,
            numArray = [],
            i;

        for (i = 0; i < len; ++i)
        {
            numArray.push(parseInt(stringArray[i], 10));
        }
        return numArray;
    },

    chordAttributes = function (chordDefNode)
    {
        var a,
            attributes = {},
            attributesLength = chordDefNode.attributes.length,
            i;

        attributes.hasChordOff = true; // default value
        for (i = 0; i < attributesLength; ++i)
        {
            a = chordDefNode.attributes[i];

            // console.log(a.name + " = " + a.nodeValue);

            switch (a.name)
            {
                case "id":
                    attributes.id = a.nodeValue; // a string
                    break;
                case "bank":
                    attributes.bank = parseInt(a.nodeValue, 10);
                    break;
                case "patch":
                    attributes.patch = parseInt(a.nodeValue, 10);
                    break;
                case "volume":
                    attributes.volume = parseInt(a.nodeValue, 10);
                    break;
                case "hasChordOff":
                    if (a.nodeValue === "0")
                    {
                        attributes.hasChordOff = false;
                    }
                    // if hasChordOff is undefined, it is true
                    break;
                case "pitchWheelDeviation":
                    attributes.pitchWheelDeviation = parseInt(a.nodeValue, 10);
                    break;
                case "minBasicChordMsDuration":
                    attributes.minBasicChordMsDuration = parseInt(a.nodeValue, 10);
                    break;
                default:
                    throw (">>>>>>>>>> Illegal midiChord attribute  <<<<<<<<<<");
            }
        }
        // the following attributes can be undefined
        //  bank
        //  patch
        //  volume
        //  hasChordOff (true by default)
        //  pitchWheelDeviation (default is 2 or unchanged)
        //  minBasicChordMsDuration (default is 1 millisecond)
        if (attributes.id === undefined)
        {
            throw ("Error: chords must have an id!");
        }

        return attributes;
    },

    basicChordsArray = function (chordDefNode)
    {
        var basicChordsDef = chordDefNode.firstElementChild,
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
                // console.log(attr.name + " = " + attr.nodeValue);
                switch (attr.name)
                {
                    case "msDuration":
                        basicChord.msDuration = parseInt(attr.nodeValue, 10);
                        break;
                    case "bank":
                        basicChord.bank = parseInt(attr.nodeValue, 10);
                        break;
                    case "patch":
                        basicChord.patch = parseInt(attr.nodeValue, 10);
                        break;
                    case "hasChordOff":
                        if (attr.nodeValue === "0")
                        {
                            basicChord.hasChordOff = false;
                        }
                        // is true if undefined
                        break;
                    case "notes":
                        basicChord.notes = [];
                        basicChord.notes = numberArray(attr.nodeValue);
                        break;
                    case "velocities":
                        basicChord.velocities = [];
                        basicChord.velocities = numberArray(attr.nodeValue);
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
            || basicChord.notes === undefined
            || basicChord.velocities === undefined)
            {
                throw ("Error: all basic chords must have msDuration, notes and velocities");
            }

            if (basicChord.notes.length !== basicChord.velocities.length)
            {
                throw ("Error: basic chord must have the same number of notes and velocities");
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
    sliders = function (chordDefNode)
    {
        var sliders = {},
            attr,
            attributesLength,
            slidersDef = chordDefNode.lastElementChild,
            i;

        if (slidersDef !== null)
        {
            attributesLength = slidersDef.attributes.length;
            for (i = 0; i < attributesLength; ++i)
            {
                attr = slidersDef.attributes[i];
                // console.log(attr.name + " = " + attr.nodeValue);

                switch (attr.name)
                {
                    case "pitchWheel":
                        sliders.pitchWheel = [];
                        sliders.pitchWheel = numberArray(attr.nodeValue);
                        break;
                    case "pan":
                        sliders.pan = [];
                        sliders.pan = numberArray(attr.nodeValue);
                        break;
                    case "modulationWheel":
                        sliders.modulationWheel = [];
                        sliders.modulationWheel = numberArray(attr.nodeValue);
                        break;
                    case "expressionSlider":
                        sliders.expressionSlider = [];
                        sliders.expressionSlider = numberArray(attr.nodeValue);
                        break;
                    default:
                        throw (">>>>>>>>>> Illegal slider <<<<<<<<<<");
                }
            }
        }
        return sliders;
    },

    restAttributes = function (restDefNode)
    {
        var attr,
            attributes = {},
            attributesLength = restDefNode.attributes.length,
            i;

        for (i = 0; i < attributesLength; ++i)
        {
            attr = restDefNode.attributes[i];

            // console.log(attr.name + " = " + attr.nodeValue);

            switch (attr.name)
            {
                case "id":
                    attributes.id = attr.nodeValue; // a string
                    break;
                case "msDuration":
                    attributes.msDuration = parseInt(attr.nodeValue, 10);
                    break;
                default:
                    throw (">>>>>>>>>> Illegal midiChord attribute  <<<<<<<<<<");
            }
        }
        if (attributes.id === undefined)
        {
            throw ("Error: rests must have an id!");
        }

        if (attributes.msDuration === undefined)
        {
            throw ("Error: rests must have an msDuration!");
        }

        return attributes;
    },

    // ChordDef constructor
    // The chord contains the chordDef information from the XML in a form that is easier to program with.
    // The ChordDef has the following fields:
    //    chord.attributes
    //    chord.basicChordsArray[]
    //    chord.sliders
    //
    // chord.attributes can be:
    //       chord.attributes.id (compulsory string)
    //       chord.attributes.bank (optional int)
    //       chord.attributes.patch (optional int)
    //       chord.attributes.volume (optional int)
    //       chord.attributes.hasChordOff (optional boolean)
    //       chord.attributes.pitchWheelDeviation (optional int)
    //       chord.attributes.minBasicChordMsDuration (optional int)
    //
    // Each basicChord in the chord.basicChordsArray[] has the following fields:
    //       basicChord.msDuration (compulsory int)
    //       basicChord.bank (optional int)
    //       basicChord.patch (optional int -- compulsory, if bank is defined)
    //       basicChord.hasChordOff (optional boolean -- true if undefined)
    //       basicChord.notes[] (compulsory int array)
    //       basicChord.velocities (compulsory int array -- notes and velocities have the same length)
    //
    // chord.sliders (which are all either undefined, or numberArrays) can be:
    //       chord.sliders.pitchWheel[]
    //       chord.sliders.pan[]
    //       chord.sliders.modulationWheel[];
    //       chord.sliders.expressionSlider[];
    ChordDef = function (chordDefNode)
    {
        if (!(this instanceof ChordDef))
        {
            return new ChordDef(chordDefNode);
        }

        this.attributes = chordAttributes(chordDefNode);
        this.basicChordsArray = basicChordsArray(chordDefNode);
        this.sliders = sliders(chordDefNode);

        return this;
    },

    // RestDef constructor
    // The RestDef contains the restDef information from the XML in a form that is easier to program with.
    // The RestDef has the following field:
    //    rest.attributes
    //
    // rest.attributes are:
    //    rest.attributes.id (compulsory string)
    //    rest.attributes.msDuration (compulsory int)
    RestDef = function (restDefNode)
    {
        if (!(this instanceof RestDef))
        {
            return new RestDef(restDefNode);
        }

        this.attributes = restAttributes(restDefNode);

        return this;
    },

    // public Palettes() constructor. Returns an empty array if there are no palettes in the score.
    // Gets the palettes defined in a "midiDefs" element in the first SVG page embedded in the HTML.
    // Palettes is an array of palette. Each palette is an array of ChordDef.
    Palettes = function (svg)
    {
        if (!(this instanceof Palettes))
        {
            return new Palettes();
        }

        var embeddedSvgPages, svgPage1,
            midiDefs, defNodes, defNode,
            id,
            defsArray = [],
            palettes = [],
            currentPaletteNumber = 1,
            i, chordDef, restDef;

        // Note that document has been passed as a local variable to this namespace.
        embeddedSvgPages = document.querySelectorAll(".svgPage");
        svgPage1 = svg.getSVGDocument(embeddedSvgPages[0]); // public function (see above)
        midiDefs = svgPage1.getElementsByTagName("midiDefs");
        if(midiDefs.length > 0)
        {
            defNodes = midiDefs[0].childNodes;

            for (i = 0; i < defNodes.length; ++i)
            {
                defNode = defNodes[i];
                if(defNodes[i].nodeName !== '#text' && defNodes[i].nodeName !== '#comment' && defNodes[i].nodeName !== 'script')
                {
                    id = defNode.getAttribute("id");

                    if (paletteNumber(id) !== currentPaletteNumber)
                    {
                        palettes.push(defsArray);
                        defsArray = [];
                        currentPaletteNumber++;
                    }

                    if (id.indexOf("chord") > 0)
                    {
                        chordDef = new ChordDef(defNode);
                        defsArray.push(chordDef);
                    }
                    else if (id.indexOf("rest") > 0)
                    {
                        restDef = new RestDef(defNode);
                        defsArray.push(restDef);
                    }
                }
            }
            palettes.push(defsArray);
        }
        return palettes;
    },

    // public API
    publicAPI =
    {
        // public ChordDef(chordDefNode) constructor.
        // This constructor is public, so that it can also be used when loading chords which are defined locally
        // in scores rather than in a palette (when the ChordDef is not being 'used').
        ChordDef: ChordDef,

        // public Palettes() constructor.
        // Gets the palettes defined in a "midiDefs" element in the first SVG page embedded in the HTML.
        // Palettes is an array of palette. Each palette is an array of ChordDef and RestDef.
        // Note that RestDefs are placeholders in palettes. They are never actually referred to outside this namespace,
        // so their definition is not public.
        Palettes: Palettes
    };

    return publicAPI;

} (document));

