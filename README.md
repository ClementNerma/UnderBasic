
# UnderBasic

UnderBasic is a programming language for the TI-82/83/84 calculator series. It's in fact an alternative to the built-in TI-Basic.  
You can create your own programs in UnderBasic and "compile" it for your calculator with this tool. Technically, it converts the UnderBasic code into TI-Basic.

## Online demo
You can test the language here: https://underbasic-clementnerma.c9.io/index.html  
On the left, type UnderBasic code, and you'll see the converted TI-Basic code appear on the right.

## Features
UnderBasic allows you to:
* Define functions
* Use custom-named variables
* Code with a simpler syntax
* Have access to a functions library

## Examples
### Functions:
<table>
  <tr><td><b>UnderBasic</b></td><td><b>TI-Basic (converted)</b></td></tr>
  <tr><td><pre>name is Str1

function sayHello (person) {
    print("Hello " + person)
}

input(name, "Name? ")
sayHello(name)</pre>
</td><td><pre>Input "Name?",Str1
Disp "Hello " + Str1</pre></td></tr>
</table>
### Fibonacci:
<table>
  <tr><td><b>UnderBasic</b></td><td><b>TI-Basic (converted)</b></td></tr>
  <tr><td><pre>i is A
suite is _SUITE

suite = [0, 1]
for(i, 3, 18) {
    suite[i] = suite[i - 2] + suite[i - 1]
    print suite[i]
}</pre>
</td><td><pre>{0, 1}→LSuite
For(A,3,18)
⌊SUITE(A-2)+⌊SUITE(A-1)→⌊SUITE(A)
Disp ⌊SUITE(A)
End</pre></td></tr>
</table>

#### More coming soon!

## Resources
* https://tiplanet.org/forum/viewtopic.php?f=12&t=17245 - TI-Planet topic about the project *(in French)*
