/*
 *  copyright 2013 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  This code was adapted from JavaScript Patterns (O'Reilly, Stoyan Stephanov), page 89.
 *  As far as this code can be considered my work, it is licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  Namespace.js
 *  Basic code for creating and using namespaces.
 *  
 */

var WEB_MIDI_LIB = WEB_MIDI_LIB || {};

WEB_MIDI_LIB.namespace = function (ns_string)
{
    "use strict";
    var parts = ns_string.split('.'),
        parent = WEB_MIDI_LIB,
        i;

    // strip redundant leading global
    if (parts[0] === "WEB_MIDI_LIB")
    {
        parts = parts.slice(1);
    }

    for (i = 0; i < parts.length; ++i)
    {
        // create a property if it does not exist
        if (typeof parent[parts[i]] === "undefined")
        {
            parent[parts[i]] = {};
            parent = parent[parts[i]];
        }
    }
    return parent;
};

