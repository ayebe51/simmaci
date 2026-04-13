<?php
1: <?php
2: 
3: namespace App\Http\Middleware;
4: 
5: use Closure;
6: use Illuminate\Http\Request;
7: use Symfony\Component\HttpFoundation\Response;
8: 
9: class CheckRole
10: {
11:     /**
12:      * Handle an incoming request.
13:      *
14:      * @param  \Illuminate\Http\Request  $request
15:      * @param  \Closure  $next
16:      * @param  string  ...$roles
17:      * @return \Symfony\Component\HttpFoundation\Response
18:      */
19:     public function handle(Request $request, Closure $next, ...$roles): Response
20:     {
21:         $user = $request->user();
22: 
23:         if (! $user) {
24:             return response()->json([
25:                 'success' => false,
26:                 'message' => 'Unauthorized.',
27:             ], 401);
28:         }
29: 
30:         if (in_array($user->role, $roles)) {
31:             return $next($request);
32:         }
33: 
34:         return response()->json([
35:             'success' => false,
36:             'message' => 'Forbidden: You do not have the required role to access this resource.',
37:         ], 403);
38:     }
39: }
40: 
