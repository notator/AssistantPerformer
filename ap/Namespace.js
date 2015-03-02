/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  This code was adapted from JavaScript Patterns (O'Reilly, Stoyan Stephanov), page 89.
 *  As far as this code can be considered my work, it is licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/Namespace.js
 *  Basic code for creating and using namespaces.
 *  
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

var _AP = _AP || {};

_AP.namespace = function (ns_string)
{
    "use strict";
    var parts = ns_string.split('.'),
        parent = _AP,
        i;

    // strip redundant leading global
    if (parts[0] === "_AP")
    {
        parts = parts.slice(1);
    }

    for (i = 0; i < parts.length; ++i)
    {
        // create a property if it does not exist
        if (parent[parts[i]] === undefined)
        {
            parent[parts[i]] = {};
            parent = parent[parts[i]];
        }
    }
    return parent;
};

