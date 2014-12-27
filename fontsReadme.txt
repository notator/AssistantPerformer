
24th June 2012
CLicht is now working again on all major browsers!
    
Note that Firefox requires that the server address is *exactly* the same as for the fonts.
(Using http://www.james-ingram-act-two.de just for the fonts does not work.)
I cannot, for example, access the fonts on www.james-ingram-act-two.de from james-ingram.de
in Firefox (in other browsers this is possible).
*Nobody* can use these fonts in Firefox except me! To change that, I would have to enable CORS
https://developer.mozilla.org/En/HTTP_access_control

I originally created this font in 1994, as a Postscript Type 1 font, using Letraset's
FontStudio program (which no longer exists) on a Mac Quadra. The font was, and is, used
in scores printed by the Stockhausen-Verlag
http://www.karlheinzstockhausen.org/

The original postscript font was converted to .otf by a friend who had the necessary
software, and I have never had any problems with it when installed on Windows and used
locally.

One thing is curious however: As I understand it, the original font had characters in
range U+00-FF, but when I look at the Unicodes in the .otf font (visible when using
the "insert special character" dialog in Word), the top 43 characters have Unicodes outside that
range. The top character is at U+FB02 !

Apropos copyright:
The original copyright in the font says "Copyright 1994 K. Stockhausen, J. Ingram".
When I asked Stockhausen's heirs if I could make the font public, and use it on my website,
they said "Its your font, do what you like with it!"
I'd like to change the copyright to an MIT licence, but don't know how that can be done. 