
UnderBasic v0.6
- Improved libraries
- Added support for aliases
- Added blocks support
- Added syntax highlighting
- Added #set directive (useful for undefined arguments)
- Added #script---#endscript directive for running JavaScript plugins from library functions (allowed only in includes files)
- Added support for return instruction
- Added support for functions call on variables assignements
- Added support for blocks into other blocks
- Minor: Improved translation function
- Minor: Added support for matrix indexes ( "[A][1,5]" => "[A](1,5)" )
- Minor: Added support for multiple lines comments
- Fixed: Support of quotes : aliases are not working between quotes anymore
- Fixed: When failed to compile, auto-save was destroyed [on page's loading]
- Fixed: Syntax error with mathematical operations that includes some variables, lists or matrix
- Fixed: Bugs with arguments which contains operators ("+"...) : e.g. : Disp "Splitten : " + Str1 -> Disp "Splitten :"
