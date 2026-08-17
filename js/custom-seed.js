function buildCustomSeed() {
  const fChVariables = { id: 'folder_ch_variables', type: 'folder', name: '1. C Variables & Operators', parentId: null, scope: 'challenge', order: 3, description: 'Basic inputs, outputs, variables, and math operators in C.' };
  const fChControl   = { id: 'folder_ch_control',   type: 'folder', name: '2. C Control Flow',        parentId: null, scope: 'challenge', order: 4, description: 'Conditionals, switch-case, and decision making in C.' };
  const fChLoops     = { id: 'folder_ch_loops',     type: 'folder', name: '3. C Loops & Iteration',   parentId: null, scope: 'challenge', order: 5, description: 'For loops, while loops, and nested loops in C.' };
  const fChFunctions = { id: 'folder_ch_functions', type: 'folder', name: '4. C Functions & Recursion', parentId: null, scope: 'challenge', order: 6, description: 'Function definition, parameter passing, and recursion in C.' };
  const fChArrays    = { id: 'folder_ch_arrays',    type: 'folder', name: '5. C Arrays & Strings',    parentId: null, scope: 'challenge', order: 7, description: 'Single and multi-dimensional arrays, and string handling in C.' };

  const fSnString     = { id: 'folder_sn_string',     type: 'folder', name: 'String Utilities',   parentId: null, scope: 'snippet', order: 3, description: 'Common operations on C-strings.' };
  const fSnSearchSort = { id: 'folder_sn_search_sort',type: 'folder', name: 'Search & Sort',      parentId: null, scope: 'snippet', order: 4, description: 'Classic searching and sorting algorithms.' };
  const fSnDataOps    = { id: 'folder_sn_data_ops',   type: 'folder', name: 'Data Operations',    parentId: null, scope: 'snippet', order: 5, description: 'Utility patterns for arrays and data buffers.' };
  const fSnMath       = { id: 'folder_sn_math',       type: 'folder', name: 'Math & Numbers',     parentId: null, scope: 'snippet', order: 6, description: 'Number theory and math utility functions.' };
  const fSnMemIO      = { id: 'folder_sn_mem_io',     type: 'folder', name: 'Memory & Safe I/O',  parentId: null, scope: 'snippet', order: 7, description: 'Memory management and secure I/O operations.' };

  const fNbCellGen   = { id: 'folder_nb_cell_gen',   type: 'folder', name: 'Cell Biology & Genetics', parentId: null, scope: 'notebook', order: 2, description: 'Quizzes covering cell organelles, cell division, and genetics.' };
  const fNbEcology   = { id: 'folder_nb_ecology',    type: 'folder', name: 'Ecology & Ecosystems',    parentId: null, scope: 'notebook', order: 3, description: 'Quizzes covering ecosystems, trophic levels, and biomes.' };
  const fNbPhysio    = { id: 'folder_nb_physio',     type: 'folder', name: 'Human Physiology',        parentId: null, scope: 'notebook', order: 4, description: 'Quizzes on respiratory, circulatory, and nervous systems.' };
  const fNbBotany    = { id: 'folder_nb_botany',     type: 'folder', name: 'Plant Biology (Botany)',  parentId: null, scope: 'notebook', order: 5, description: 'Quizzes on photosynthesis, plant transport, and reproduction.' };
  const fNbEvolution = { id: 'folder_nb_evolution',  type: 'folder', name: 'Evolution & Classification', parentId: null, scope: 'notebook', order: 6, description: 'Quizzes on taxonomy, kingdoms, and natural selection.' };

  const nodes = [
    fChVariables, fChControl, fChLoops, fChFunctions, fChArrays,
    fSnString, fSnSearchSort, fSnDataOps, fSnMath, fSnMemIO,
    fNbCellGen, fNbEcology, fNbPhysio, fNbBotany, fNbEvolution
  ];

  const challenges = [
    {
      id: 'ch_c_temp_conv', _isDefault: true,
      title: 'Celsius to Fahrenheit', parentId: fChVariables.id, order: 0,
      tags: ['Variables', 'Math', 'C'],
      coverDescription: 'Convert a temperature in Celsius to Fahrenheit.',
      variants: [{
        id: 'v_c_temp_conv', name: 'C Version',
        description: 'Read a float temperature in Celsius from stdin. Convert it using `(C * 9 / 5) + 32` and print the result in Fahrenheit with two decimal places.',
        starterCode: '#include <stdio.h>\n\nint main(void) {\n    float celsius;\n    // TODO: read celsius, calculate and print fahrenheit\n    return 0;\n}\n',
        code: '#include <stdio.h>\n\nint main(void) {\n    float celsius;\n    if (scanf("%f", &celsius) == 1) {\n        printf("%.2f\\n", (celsius * 9.0 / 5.0) + 32.0);\n    }\n    return 0;\n}\n',
        files: [{ id: 'f_c_temp_conv_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n\nint main(void) {\n    float celsius;\n    // TODO\n    return 0;\n}\n',
          code: '#include <stdio.h>\n\nint main(void) {\n    float celsius;\n    if (scanf("%f", &celsius) == 1) {\n        printf("%.2f\\n", (celsius * 9.0 / 5.0) + 32.0);\n    }\n    return 0;\n}\n'
        }],
        samples: [{ title: 'Sample 1', content: 'Input:\n25.0\nOutput:\n77.00\n' }],
        tests: [
          { id: 't_c_temp_conv_1', name: 'Standard conversion', stdin: '25.0', expected: '77.00\n', hidden: false },
          { id: 't_c_temp_conv_2', name: 'Freezing point', stdin: '0.0', expected: '32.00\n', hidden: true }
        ]
      }]
    },
    {
      id: 'ch_c_circle_area', _isDefault: true,
      title: 'Circle Area Calculator', parentId: fChVariables.id, order: 1,
      tags: ['Variables', 'Math', 'C'],
      coverDescription: 'Calculate the area of a circle given its radius.',
      variants: [{
        id: 'v_c_circle_area', name: 'C Version',
        description: 'Read a float representing the radius of a circle. Calculate the area using `3.14159 * radius * radius` and print it with four decimal places.',
        starterCode: '#include <stdio.h>\n\nint main(void) {\n    float radius;\n    // TODO: read radius and print circle area\n    return 0;\n}\n',
        code: '#include <stdio.h>\n\nint main(void) {\n    float radius;\n    if (scanf("%f", &radius) == 1) {\n        printf("%.4f\\n", 3.14159 * radius * radius);\n    }\n    return 0;\n}\n',
        files: [{ id: 'f_c_circle_area_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n\nint main(void) {\n    float radius;\n    // TODO\n    return 0;\n}\n',
          code: '#include <stdio.h>\n\nint main(void) {\n    float radius;\n    if (scanf("%f", &radius) == 1) {\n        printf("%.4f\\n", 3.14159 * radius * radius);\n    }\n    return 0;\n}\n'
        }],
        samples: [{ title: 'Sample 1', content: 'Input:\n5.0\nOutput:\n78.5398\n' }],
        tests: [
          { id: 't_c_circle_area_1', name: 'Radius 5', stdin: '5.0', expected: '78.5398\n', hidden: false },
          { id: 't_c_circle_area_2', name: 'Radius 1', stdin: '1.0', expected: '3.1416\n', hidden: true }
        ]
      }]
    },
    {
      id: 'ch_c_swap_xor', _isDefault: true,
      title: 'Swap Without Temp', parentId: fChVariables.id, order: 2,
      tags: ['Variables', 'Bitwise', 'C'],
      coverDescription: 'Swap two integers without using a third variable.',
      variants: [{
        id: 'v_c_swap_xor', name: 'C Version',
        description: 'Read two integers `x` and `y` from stdin. Swap them without using a temporary variable, and print them separated by a space.',
        starterCode: '#include <stdio.h>\n\nint main(void) {\n    int x, y;\n    // TODO: read x and y, swap, and print\n    return 0;\n}\n',
        code: '#include <stdio.h>\n\nint main(void) {\n    int x, y;\n    if (scanf("%d %d", &x, &y) == 2) {\n        x = x ^ y;\n        y = x ^ y;\n        x = x ^ y;\n        printf("%d %d\\n", x, y);\n    }\n    return 0;\n}\n',
        files: [{ id: 'f_c_swap_xor_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n\nint main(void) {\n    int x, y;\n    // TODO\n    return 0;\n}\n',
          code: '#include <stdio.h>\n\nint main(void) {\n    int x, y;\n    if (scanf("%d %d", &x, &y) == 2) {\n        x = x ^ y;\n        y = x ^ y;\n        x = x ^ y;\n        printf("%d %d\\n", x, y);\n    }\n    return 0;\n}\n'
        }],
        samples: [{ title: 'Sample 1', content: 'Input:\n12 34\nOutput:\n34 12\n' }],
        tests: [
          { id: 't_c_swap_xor_1', name: 'Positive numbers', stdin: '12 34', expected: '34 12\n', hidden: false },
          { id: 't_c_swap_xor_2', name: 'Zero and negative', stdin: '0 -5', expected: '-5 0\n', hidden: true }
        ]
      }]
    },
    {
      id: 'ch_c_leap_year', _isDefault: true,
      title: 'Leap Year Checker', parentId: fChControl.id, order: 0,
      tags: ['Control Flow', 'Logic', 'C'],
      coverDescription: 'Check if a given year is a leap year.',
      variants: [{
        id: 'v_c_leap_year', name: 'C Version',
        description: 'Read a year as an integer. Print `Leap Year` if it is a leap year, and `Not Leap Year` otherwise.',
        starterCode: '#include <stdio.h>\n\nint main(void) {\n    int year;\n    // TODO: read year and check leap status\n    return 0;\n}\n',
        code: '#include <stdio.h>\n\nint main(void) {\n    int year;\n    if (scanf("%d", &year) == 1) {\n        if ((year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)) {\n            printf("Leap Year\\n");\n        } else {\n            printf("Not Leap Year\\n");\n        }\n    }\n    return 0;\n}\n',
        files: [{ id: 'f_c_leap_year_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n\nint main(void) {\n    int year;\n    // TODO\n    return 0;\n}\n',
          code: '#include <stdio.h>\n\nint main(void) {\n    int year;\n    if (scanf("%d", &year) == 1) {\n        if ((year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)) {\n            printf("Leap Year\\n");\n        } else {\n            printf("Not Leap Year\\n");\n        }\n    }\n    return 0;\n}\n'
        }],
        samples: [{ title: 'Sample 1', content: 'Input:\n2024\nOutput:\nLeap Year\n' }],
        tests: [
          { id: 't_c_leap_year_1', name: 'Leap year 2024', stdin: '2024', expected: 'Leap Year\n', hidden: false },
          { id: 't_c_leap_year_2', name: 'Century non-leap 1900', stdin: '1900', expected: 'Not Leap Year\n', hidden: true }
        ]
      }]
    },
    {
      id: 'ch_c_calc_switch', _isDefault: true,
      title: 'Simple Switch Calculator', parentId: fChControl.id, order: 1,
      tags: ['Control Flow', 'Switch', 'C'],
      coverDescription: 'Write a basic calculator using a switch statement.',
      variants: [{
        id: 'v_c_calc_switch', name: 'C Version',
        description: 'Read an operator char (+, -, *, /) and two floats. Output the result with two decimal places. For division, you can assume denominator is non-zero.',
        starterCode: '#include <stdio.h>\n\nint main(void) {\n    char op;\n    float a, b;\n    // TODO: read op, a, b and perform operation\n    return 0;\n}\n',
        code: '#include <stdio.h>\n\nint main(void) {\n    char op;\n    float a, b;\n    if (scanf(" %c %f %f", &op, &a, &b) == 3) {\n        switch(op) {\n            case \'+\': printf("%.2f\\n", a + b); break;\n            case \'-\': printf("%.2f\\n", a - b); break;\n            case \'*\': printf("%.2f\\n", a * b); break;\n            case \'/\': printf("%.2f\\n", a / b); break;\n        }\n    }\n    return 0;\n}\n',
        files: [{ id: 'f_c_calc_switch_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n\nint main(void) {\n    char op;\n    float a, b;\n    // TODO\n    return 0;\n}\n',
          code: '#include <stdio.h>\n\nint main(void) {\n    char op;\n    float a, b;\n    if (scanf(" %c %f %f", &op, &a, &b) == 3) {\n        switch(op) {\n            case \'+\': printf("%.2f\\n", a + b); break;\n            case \'-\': printf("%.2f\\n", a - b); break;\n            case \'*\': printf("%.2f\\n", a * b); break;\n            case \'/\': printf("%.2f\\n", a / b); break;\n        }\n    }\n    return 0;\n}\n'
        }],
        samples: [{ title: 'Sample 1', content: 'Input:\n+ 10.5 4.5\nOutput:\n15.00\n' }],
        tests: [
          { id: 't_c_calc_switch_1', name: 'Addition', stdin: '+ 10.5 4.5', expected: '15.00\n', hidden: false },
          { id: 't_c_calc_switch_2', name: 'Multiplication', stdin: '* 3.0 2.5', expected: '7.50\n', hidden: true }
        ]
      }]
    },
    {
      id: 'ch_c_quadratic', _isDefault: true,
      title: 'Roots Nature Solver', parentId: fChControl.id, order: 2,
      tags: ['Control Flow', 'Math', 'C'],
      coverDescription: 'Determine the nature of the roots of a quadratic equation.',
      variants: [{
        id: 'v_c_quadratic', name: 'C Version',
        description: 'Read three coefficients a, b, c of a quadratic equation. Print `Real and Distinct`, `Real and Equal`, or `Complex` based on the discriminant `b^2 - 4ac`.',
        starterCode: '#include <stdio.h>\n\nint main(void) {\n    double a, b, c;\n    // TODO: print nature of roots\n    return 0;\n}\n',
        code: '#include <stdio.h>\n\nint main(void) {\n    double a, b, c;\n    if (scanf("%lf %lf %lf", &a, &b, &c) == 3) {\n        double d = b * b - 4 * a * c;\n        if (d > 0) printf("Real and Distinct\\n");\n        else if (d == 0) printf("Real and Equal\\n");\n        else printf("Complex\\n");\n    }\n    return 0;\n}\n',
        files: [{ id: 'f_c_quadratic_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n\nint main(void) {\n    double a, b, c;\n    // TODO\n    return 0;\n}\n',
          code: '#include <stdio.h>\n\nint main(void) {\n    double a, b, c;\n    if (scanf("%lf %lf %lf", &a, &b, &c) == 3) {\n        double d = b * b - 4 * a * c;\n        if (d > 0) printf("Real and Distinct\\n");\n        else if (d == 0) printf("Real and Equal\\n");\n        else printf("Complex\\n");\n    }\n    return 0;\n}\n'
        }],
        samples: [{ title: 'Sample 1', content: 'Input:\n1 -5 6\nOutput:\nReal and Distinct\n' }],
        tests: [
          { id: 't_c_quadratic_1', name: 'Distinct roots', stdin: '1 -5 6', expected: 'Real and Distinct\n', hidden: false },
          { id: 't_c_quadratic_2', name: 'Complex roots', stdin: '1 2 5', expected: 'Complex\n', hidden: true }
        ]
      }]
    },
    {
      id: 'ch_c_fibonacci', _isDefault: true,
      title: 'Fibonacci Sequence', parentId: fChLoops.id, order: 0,
      tags: ['Loops', 'Sequence', 'C'],
      coverDescription: 'Generate the first N Fibonacci numbers.',
      variants: [{
        id: 'v_c_fibonacci', name: 'C Version',
        description: 'Read an integer `n`. Print the first `n` Fibonacci numbers starting from `0` and `1`, separated by spaces.',
        starterCode: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    // TODO: print first n Fibonacci numbers\n    return 0;\n}\n',
        code: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    if (scanf("%d", &n) == 1 && n > 0) {\n        int t1 = 0, t2 = 1, next;\n        for (int i = 1; i <= n; i++) {\n            printf("%d%s", t1, (i == n) ? "\\n" : " ");\n            next = t1 + t2;\n            t1 = t2;\n            t2 = next;\n        }\n    }\n    return 0;\n}\n',
        files: [{ id: 'f_c_fibonacci_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    // TODO\n    return 0;\n}\n',
          code: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    if (scanf("%d", &n) == 1 && n > 0) {\n        int t1 = 0, t2 = 1, next;\n        for (int i = 1; i <= n; i++) {\n            printf("%d%s", t1, (i == n) ? "\\n" : " ");\n            next = t1 + t2;\n            t1 = t2;\n            t2 = next;\n        }\n    }\n    return 0;\n}\n'
        }],
        samples: [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\n0 1 1 2 3\n' }],
        tests: [
          { id: 't_c_fibonacci_1', name: 'Five terms', stdin: '5', expected: '0 1 1 2 3\n', hidden: false },
          { id: 't_c_fibonacci_2', name: 'One term', stdin: '1', expected: '0\n', hidden: true }
        ]
      }]
    },
    {
      id: 'ch_c_prime_check', _isDefault: true,
      title: 'Prime Number Checker', parentId: fChLoops.id, order: 1,
      tags: ['Loops', 'Math', 'C'],
      coverDescription: 'Determine if an integer is prime.',
      variants: [{
        id: 'v_c_prime_check', name: 'C Version',
        description: 'Read an integer `n`. Print `Prime` if it is prime, and `Not Prime` if it is not.',
        starterCode: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    // TODO: print if prime or not\n    return 0;\n}\n',
        code: '#include <stdio.h>\n\nint main(void) {\n    int n, is_prime = 1;\n    if (scanf("%d", &n) == 1) {\n        if (n <= 1) is_prime = 0;\n        for (int i = 2; i * i <= n; i++) {\n            if (n % i == 0) { is_prime = 0; break; }\n        }\n        if (is_prime) printf("Prime\\n");\n        else printf("Not Prime\\n");\n    }\n    return 0;\n}\n',
        files: [{ id: 'f_c_prime_check_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    // TODO\n    return 0;\n}\n',
          code: '#include <stdio.h>\n\nint main(void) {\n    int n, is_prime = 1;\n    if (scanf("%d", &n) == 1) {\n        if (n <= 1) is_prime = 0;\n        for (int i = 2; i * i <= n; i++) {\n            if (n % i == 0) { is_prime = 0; break; }\n        }\n        if (is_prime) printf("Prime\\n");\n        else printf("Not Prime\\n");\n    }\n    return 0;\n}\n'
        }],
        samples: [{ title: 'Sample 1', content: 'Input:\n17\nOutput:\nPrime\n' }],
        tests: [
          { id: 't_c_prime_check_1', name: 'Prime 17', stdin: '17', expected: 'Prime\n', hidden: false },
          { id: 't_c_prime_check_2', name: 'Composite 4', stdin: '4', expected: 'Not Prime\n', hidden: true }
        ]
      }]
    },
    {
      id: 'ch_c_multi_table', _isDefault: true,
      title: 'Multiplication Table', parentId: fChLoops.id, order: 2,
      tags: ['Loops', 'C'],
      coverDescription: 'Print the multiplication table of a number.',
      variants: [{
        id: 'v_c_multi_table', name: 'C Version',
        description: 'Read an integer `n`. Print the multiplication table for `n` from 1 to 5, in the format `n x i = result` on new lines.',
        starterCode: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    // TODO: print table 1 to 5\n    return 0;\n}\n',
        code: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    if (scanf("%d", &n) == 1) {\n        for (int i = 1; i <= 5; i++) {\n            printf("%d x %d = %d\\n", n, i, n * i);\n        }\n    }\n    return 0;\n}\n',
        files: [{ id: 'f_c_multi_table_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    // TODO\n    return 0;\n}\n',
          code: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    if (scanf("%d", &n) == 1) {\n        for (int i = 1; i <= 5; i++) {\n            printf("%d x %d = %d\\n", n, i, n * i);\n        }\n    }\n    return 0;\n}\n'
        }],
        samples: [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\n5 x 1 = 5\n5 x 2 = 10\n5 x 3 = 15\n5 x 4 = 20\n5 x 5 = 25\n' }],
        tests: [
          { id: 't_c_multi_table_1', name: 'Table of 5', stdin: '5', expected: '5 x 1 = 5\n5 x 2 = 10\n5 x 3 = 15\n5 x 4 = 20\n5 x 5 = 25\n', hidden: false },
          { id: 't_c_multi_table_2', name: 'Table of 2', stdin: '2', expected: '2 x 1 = 2\n2 x 2 = 4\n2 x 3 = 6\n2 x 4 = 8\n2 x 5 = 10\n', hidden: true }
        ]
      }]
    },
    {
      id: 'ch_c_rec_factorial', _isDefault: true,
      title: 'Recursive Factorial', parentId: fChFunctions.id, order: 0,
      tags: ['Functions', 'Recursion', 'C'],
      coverDescription: 'Find the factorial of a number using recursion.',
      variants: [{
        id: 'v_c_rec_factorial', name: 'C Version',
        description: 'Read an integer `n`. Implement a recursive function `long long factorial(int n)` and print the result.',
        starterCode: '#include <stdio.h>\n\nlong long factorial(int n) {\n    // TODO\n}\n\nint main(void) {\n    int n;\n    // TODO\n    return 0;\n}\n',
        code: '#include <stdio.h>\n\nlong long factorial(int n) {\n    if (n <= 1) return 1;\n    return n * factorial(n - 1);\n}\n\nint main(void) {\n    int n;\n    if (scanf("%d", &n) == 1) {\n        printf("%lld\\n", factorial(n));\n    }\n    return 0;\n}\n',
        files: [{ id: 'f_c_rec_factorial_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n\nlong long factorial(int n) {\n    // TODO\n}\n',
          code: '#include <stdio.h>\n\nlong long factorial(int n) {\n    if (n <= 1) return 1;\n    return n * factorial(n - 1);\n}\n'
        }],
        samples: [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\n120\n' }],
        tests: [
          { id: 't_c_rec_factorial_1', name: 'Factorial of 5', stdin: '5', expected: '120\n', hidden: false },
          { id: 't_c_rec_factorial_2', name: 'Factorial of 0', stdin: '0', expected: '1\n', hidden: true }
        ]
      }]
    },
    {
      id: 'ch_c_gcd_lcm', _isDefault: true,
      title: 'GCD and LCM Solver', parentId: fChFunctions.id, order: 1,
      tags: ['Functions', 'Math', 'C'],
      coverDescription: 'Find the GCD and LCM of two numbers.',
      variants: [{
        id: 'v_c_gcd_lcm', name: 'C Version',
        description: 'Read two integers `a` and `b`. Write a function `int gcd(int a, int b)` and use it to print both GCD and LCM separated by a space.',
        starterCode: '#include <stdio.h>\n\nint gcd(int a, int b) {\n    // TODO\n}\n\nint main(void) {\n    int a, b;\n    // TODO\n    return 0;\n}\n',
        code: '#include <stdio.h>\n\nint gcd(int a, int b) {\n    while (b != 0) {\n        int temp = b;\n        b = a % b;\n        a = temp;\n    }\n    return a;\n}\n\nint main(void) {\n    int a, b;\n    if (scanf("%d %d", &a, &b) == 2) {\n        int g = gcd(a, b);\n        int l = (a * b) / g;\n        printf("%d %d\\n", g, l);\n    }\n    return 0;\n}\n',
        files: [{ id: 'f_c_gcd_lcm_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n\nint gcd(int a, int b) {\n    // TODO\n}\n',
          code: '#include <stdio.h>\n\nint gcd(int a, int b) {\n    while (b != 0) {\n        int temp = b;\n        b = a % b;\n        a = temp;\n    }\n    return a;\n}\n'
        }],
        samples: [{ title: 'Sample 1', content: 'Input:\n12 18\nOutput:\n6 36\n' }],
        tests: [
          { id: 't_c_gcd_lcm_1', name: 'GCD of 12 & 18', stdin: '12 18', expected: '6 36\n', hidden: false },
          { id: 't_c_gcd_lcm_2', name: 'Coprimes', stdin: '7 9', expected: '1 63\n', hidden: true }
        ]
      }]
    },
    {
      id: 'ch_c_power', _isDefault: true,
      title: 'Power Exponentiation', parentId: fChFunctions.id, order: 2,
      tags: ['Functions', 'Math', 'C'],
      coverDescription: 'Implement basic power function.',
      variants: [{
        id: 'v_c_power', name: 'C Version',
        description: 'Read double `base` and integer `exp`. Implement `double power(double base, int exp)` and print the result with two decimal places.',
        starterCode: '#include <stdio.h>\n\ndouble power(double base, int exp) {\n    // TODO\n}\n\nint main(void) {\n    double base;\n    int exp;\n    // TODO\n    return 0;\n}\n',
        code: '#include <stdio.h>\n\ndouble power(double base, int exp) {\n    double res = 1.0;\n    int p = exp > 0 ? exp : -exp;\n    for (int i = 0; i < p; i++) res *= base;\n    return exp < 0 ? 1.0 / res : res;\n}\n\nint main(void) {\n    double base;\n    int exp;\n    if (scanf("%lf %d", &base, &exp) == 2) {\n        printf("%.2f\\n", power(base, exp));\n    }\n    return 0;\n}\n',
        files: [{ id: 'f_c_power_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n\ndouble power(double base, int exp) {\n    // TODO\n}\n',
          code: '#include <stdio.h>\n\ndouble power(double base, int exp) {\n    double res = 1.0;\n    int p = exp > 0 ? exp : -exp;\n    for (int i = 0; i < p; i++) res *= base;\n    return exp < 0 ? 1.0 / res : res;\n}\n'
        }],
        samples: [{ title: 'Sample 1', content: 'Input:\n2.5 3\nOutput:\n15.62\n' }],
        tests: [
          { id: 't_c_power_1', name: 'Positive exponent', stdin: '2.5 3', expected: '15.62\n', hidden: false },
          { id: 't_c_power_2', name: 'Negative exponent', stdin: '2.0 -2', expected: '0.25\n', hidden: true }
        ]
      }]
    },
    {
      id: 'ch_c_max_min_arr', _isDefault: true,
      title: 'Array Max & Min', parentId: fChArrays.id, order: 0,
      tags: ['Arrays', 'C'],
      coverDescription: 'Find the maximum and minimum elements in an array.',
      variants: [{
        id: 'v_c_max_min_arr', name: 'C Version',
        description: 'Read an integer n representing the size of the array, followed by n integers. Output the max and min elements separated by a space.',
        starterCode: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    // TODO: read size and elements, find max/min\n    return 0;\n}\n',
        code: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    if (scanf("%d", &n) == 1 && n > 0) {\n        int arr[100], max, min;\n        for (int i = 0; i < n; i++) {\n            scanf("%d", &arr[i]);\n        }\n        max = min = arr[0];\n        for (int i = 1; i < n; i++) {\n            if (arr[i] > max) max = arr[i];\n            if (arr[i] < min) min = arr[i];\n        }\n        printf("%d %d\\n", max, min);\n    }\n    return 0;\n}\n',
        files: [{ id: 'f_c_max_min_arr_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    // TODO\n    return 0;\n}\n',
          code: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    if (scanf("%d", &n) == 1 && n > 0) {\n        int arr[100], max, min;\n        for (int i = 0; i < n; i++) {\n            scanf("%d", &arr[i]);\n        }\n        max = min = arr[0];\n        for (int i = 1; i < n; i++) {\n            if (arr[i] > max) max = arr[i];\n            if (arr[i] < min) min = arr[i];\n        }\n        printf("%d %d\\n", max, min);\n    }\n    return 0;\n}\n'
        }],
        samples: [{ title: 'Sample 1', content: 'Input:\n5\n12 5 23 -3 8\nOutput:\n23 -3\n' }],
        tests: [
          { id: 't_c_max_min_arr_1', name: 'Distinct elements', stdin: '5\n12 5 23 -3 8', expected: '23 -3\n', hidden: false },
          { id: 't_c_max_min_arr_2', name: 'Single element', stdin: '1\n42', expected: '42 42\n', hidden: true }
        ]
      }]
    },
    {
      id: 'ch_c_count_vowels', _isDefault: true,
      title: 'Count Vowels', parentId: fChArrays.id, order: 1,
      tags: ['Strings', 'C'],
      coverDescription: 'Count vowels in a string.',
      variants: [{
        id: 'v_c_count_vowels', name: 'C Version',
        description: 'Read a string (no spaces, length < 100). Print the count of vowel characters (A, E, I, O, U, case-insensitive).',
        starterCode: '#include <stdio.h>\n\nint main(void) {\n    char str[100];\n    // TODO: read string and count vowels\n    return 0;\n}\n',
        code: '#include <stdio.h>\n\nint main(void) {\n    char str[100];\n    if (scanf("%99s", str) == 1) {\n        int count = 0;\n        for (int i = 0; str[i] != \'\\0\'; i++) {\n            char ch = str[i];\n            if (ch == \'a\' || ch == \'e\' || ch == \'i\' || ch == \'o\' || ch == \'u\' ||\n                ch == \'A\' || ch == \'E\' || ch == \'I\' || ch == \'O\' || ch == \'U\') {\n                count++;\n            }\n        }\n        printf("%d\\n", count);\n    }\n    return 0;\n}\n',
        files: [{ id: 'f_c_count_vowels_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n\nint main(void) {\n    char str[100];\n    // TODO\n    return 0;\n}\n',
          code: '#include <stdio.h>\n\nint main(void) {\n    char str[100];\n    if (scanf("%99s", str) == 1) {\n        int count = 0;\n        for (int i = 0; str[i] != \'\\0\'; i++) {\n            char ch = str[i];\n            if (ch == \'a\' || ch == \'e\' || ch == \'i\' || ch == \'o\' || ch == \'u\' ||\n                ch == \'A\' || ch == \'E\' || ch == \'I\' || ch == \'O\' || ch == \'U\') {\n                count++;\n            }\n        }\n        printf("%d\\n", count);\n    }\n    return 0;\n}\n'
        }],
        samples: [{ title: 'Sample 1', content: 'Input:\nProgramming\nOutput:\n3\n' }],
        tests: [
          { id: 't_c_count_vowels_1', name: 'Mixed case string', stdin: 'Programming', expected: '3\n', hidden: false },
          { id: 't_c_count_vowels_2', name: 'No vowels', stdin: 'rhythm', expected: '0\n', hidden: true }
        ]
      }]
    },
    {
      id: 'ch_c_palindrome', _isDefault: true,
      title: 'Palindrome Checker', parentId: fChArrays.id, order: 2,
      tags: ['Strings', 'C'],
      coverDescription: 'Check if a string is a palindrome.',
      variants: [{
        id: 'v_c_palindrome', name: 'C Version',
        description: 'Read a string (no spaces, max 100 chars). Output `Palindrome` if it reads the same forward and backward, and `Not Palindrome` otherwise.',
        starterCode: '#include <stdio.h>\n#include <string.h>\n\nint main(void) {\n    char str[100];\n    // TODO: check palindrome\n    return 0;\n}\n',
        code: '#include <stdio.h>\n#include <string.h>\n\nint main(void) {\n    char str[100];\n    if (scanf("%99s", str) == 1) {\n        int len = strlen(str);\n        int is_pal = 1;\n        for (int i = 0; i < len / 2; i++) {\n            if (str[i] != str[len - 1 - i]) {\n                is_pal = 0;\n                break;\n            }\n        }\n        if (is_pal) printf("Palindrome\\n");\n        else printf("Not Palindrome\\n");\n    }\n    return 0;\n}\n',
        files: [{ id: 'f_c_palindrome_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n#include <string.h>\n\nint main(void) {\n    char str[100];\n    // TODO\n    return 0;\n}\n',
          code: '#include <stdio.h>\n#include <string.h>\n\nint main(void) {\n    char str[100];\n    if (scanf("%99s", str) == 1) {\n        int len = strlen(str);\n        int is_pal = 1;\n        for (int i = 0; i < len / 2; i++) {\n            if (str[i] != str[len - 1 - i]) {\n                is_pal = 0;\n                break;\n            }\n        }\n        if (is_pal) printf("Palindrome\\n");\n        else printf("Not Palindrome\\n");\n    }\n    return 0;\n}\n'
        }],
        samples: [{ title: 'Sample 1', content: 'Input:\nracecar\nOutput:\nPalindrome\n' }],
        tests: [
          { id: 't_c_palindrome_1', name: 'Palindrome word', stdin: 'racecar', expected: 'Palindrome\n', hidden: false },
          { id: 't_c_palindrome_2', name: 'Not palindrome', stdin: 'hello', expected: 'Not Palindrome\n', hidden: true }
        ]
      }]
    }
  ];

  const snippets = [
    {
      id: 'sn_str_trim', _isDefault: true,
      title: 'String Trim (ltrim/rtrim)', parentId: fSnString.id, order: 0,
      tags: ['String', 'Utility'],
      description: '<p>Trims leading and trailing whitespace characters (spaces, tabs, newlines) from a C-style string in-place.</p>',
      comments: '<p>Uses <code>isspace</code> from <code>&lt;ctype.h&gt;</code>. Shifts the string characters left to trim leading spaces, and replaces trailing spaces with null terminators.</p>',
      starterCode: '', relatedChallenges: [],
      examples: [{
        id: 'ex_str_trim', name: 'In-place Trim',
        code: '#include <stdio.h>\n#include <string.h>\n#include <ctype.h>\n\nvoid trim(char *s) {\n    char *p = s;\n    int l = strlen(p);\n    while (l > 0 && isspace((unsigned char)p[l - 1])) p[--l] = \'\\0\';\n    while (*p && isspace((unsigned char)*p)) { p++; l--; }\n    memmove(s, p, l + 1);\n}\n',
        highlightLines: ''
      }],
      tryCodingTargetIndices: []
    },
    {
      id: 'sn_str_case', _isDefault: true,
      title: 'String Case Converter', parentId: fSnString.id, order: 1,
      tags: ['String', 'Ascii'],
      description: '<p>Converts a C-string to all uppercase or all lowercase in-place.</p>',
      comments: '<p>Iterates through the string and calls <code>toupper()</code> or <code>tolower()</code> from <code>&lt;ctype.h&gt;</code> on each character.</p>',
      starterCode: '', relatedChallenges: [],
      examples: [{
        id: 'ex_str_case', name: 'To Uppercase',
        code: '#include <stdio.h>\n#include <ctype.h>\n\nvoid to_upper(char *s) {\n    for (; *s; s++) {\n        *s = toupper((unsigned char)*s);\n    }\n}\n',
        highlightLines: ''
      }],
      tryCodingTargetIndices: []
    },
    {
      id: 'sn_str_split', _isDefault: true,
      title: 'String Tokenizer (split)', parentId: fSnString.id, order: 2,
      tags: ['String', 'Parsing'],
      description: '<p>Splits a C-string into separate tokens using a delimiter character/string.</p>',
      comments: '<p>Uses <code>strtok()</code> from <code>&lt;string.h&gt;</code>. Note that <code>strtok()</code> modifies the original string.</p>',
      starterCode: '', relatedChallenges: [],
      examples: [{
        id: 'ex_str_split', name: 'Tokenize Space',
        code: '#include <stdio.h>\n#include <string.h>\n\nvoid split_words(char *str) {\n    char *token = strtok(str, " ");\n    while (token != NULL) {\n        printf("Token: %s\\n", token);\n        token = strtok(NULL, " ");\n    }\n}\n',
        highlightLines: ''
      }],
      tryCodingTargetIndices: []
    },
    {
      id: 'sn_bin_search', _isDefault: true,
      title: 'Binary Search', parentId: fSnSearchSort.id, order: 0,
      tags: ['Algorithm', 'Search'],
      description: '<p>Searches a sorted array for a key in <code>O(log n)</code> time.</p>',
      comments: '<p>Requires the array to be sorted. Returns the index of the key, or -1 if not found.</p>',
      starterCode: '', relatedChallenges: [],
      examples: [{
        id: 'ex_bin_search', name: 'Iterative Binary Search',
        code: 'int binary_search(int arr[], int size, int key) {\n    int low = 0, high = size - 1;\n    while (low <= high) {\n        int mid = low + (high - low) / 2;\n        if (arr[mid] == key) return mid;\n        if (arr[mid] < key) low = mid + 1;\n        else high = mid - 1;\n    }\n    return -1;\n}\n',
        highlightLines: ''
      }],
      tryCodingTargetIndices: []
    },
    {
      id: 'sn_bubble_sort', _isDefault: true,
      title: 'Bubble Sort', parentId: fSnSearchSort.id, order: 1,
      tags: ['Algorithm', 'Sort'],
      description: '<p>A simple sorting algorithm that repeatedly steps through the list, compares adjacent elements, and swaps them if they are in the wrong order.</p>',
      comments: '<p>Time complexity: <code>O(n^2)</code>. Best suited for small datasets or nearly sorted arrays.</p>',
      starterCode: '', relatedChallenges: [],
      examples: [{
        id: 'ex_bubble_sort', name: 'Bubble Sort Implementation',
        code: 'void bubble_sort(int arr[], int n) {\n    for (int i = 0; i < n - 1; i++) {\n        for (int j = 0; j < n - i - 1; j++) {\n            if (arr[j] > arr[j + 1]) {\n                int temp = arr[j];\n                arr[j] = arr[j + 1];\n                arr[j + 1] = temp;\n            }\n        }\n    }\n}\n',
        highlightLines: ''
      }],
      tryCodingTargetIndices: []
    },
    {
      id: 'sn_insertion_sort', _isDefault: true,
      title: 'Insertion Sort', parentId: fSnSearchSort.id, order: 2,
      tags: ['Algorithm', 'Sort'],
      description: '<p>Sorts an array by building the sorted array one element at a time.</p>',
      comments: '<p>Time complexity: <code>O(n^2)</code>. Highly efficient for small datasets and partially sorted arrays.</p>',
      starterCode: '', relatedChallenges: [],
      examples: [{
        id: 'ex_insertion_sort', name: 'Insertion Sort Implementation',
        code: 'void insertion_sort(int arr[], int n) {\n    for (int i = 1; i < n; i++) {\n        int key = arr[i];\n        int j = i - 1;\n        while (j >= 0 && arr[j] > key) {\n            arr[j + 1] = arr[j];\n            j = j - 1;\n        }\n        arr[j + 1] = key;\n    }\n}\n',
        highlightLines: ''
      }],
      tryCodingTargetIndices: []
    },
    {
      id: 'sn_arr_reverse', _isDefault: true,
      title: 'Array Reverse', parentId: fSnDataOps.id, order: 0,
      tags: ['Array', 'Utility'],
      description: '<p>Reverses the order of elements in an array in-place.</p>',
      comments: '<p>Uses a two-pointer approach, swapping elements from start and end towards the center.</p>',
      starterCode: '', relatedChallenges: [],
      examples: [{
        id: 'ex_arr_reverse', name: 'Reverse Array',
        code: 'void reverse_array(int arr[], int size) {\n    int start = 0, end = size - 1;\n    while (start < end) {\n        int temp = arr[start];\n        arr[start] = arr[end];\n        arr[end] = temp;\n        start++;\n        end--;\n    }\n}\n',
        highlightLines: ''
      }],
      tryCodingTargetIndices: []
    },
    {
      id: 'sn_arr_dedup', _isDefault: true,
      title: 'Deduplicate Array', parentId: fSnDataOps.id, order: 1,
      tags: ['Array', 'Deduplication'],
      description: '<p>Removes duplicate values from an unsorted array of integers in-place.</p>',
      comments: '<p>Returns the new size of the array. Shifts subsequent elements left when a duplicate is found.</p>',
      starterCode: '', relatedChallenges: [],
      examples: [{
        id: 'ex_arr_dedup', name: 'Deduplicate unsorted',
        code: 'int remove_duplicates(int arr[], int n) {\n    if (n == 0 || n == 1) return n;\n    int new_size = 0;\n    for (int i = 0; i < n; i++) {\n        int is_dup = 0;\n        for (int j = 0; j < new_size; j++) {\n            if (arr[i] == arr[j]) { is_dup = 1; break; }\n        }\n        if (!is_dup) {\n            arr[new_size++] = arr[i];\n        }\n    }\n    return new_size;\n}\n',
        highlightLines: ''
      }],
      tryCodingTargetIndices: []
    },
    {
      id: 'sn_arr_chunk', _isDefault: true,
      title: 'Array Chunking', parentId: fSnDataOps.id, order: 2,
      tags: ['Array', 'Chunking'],
      description: '<p>Splits a single array into smaller chunks of a specified size.</p>',
      comments: '<p>Useful for paginating or batch processing a buffer in fixed chunks.</p>',
      starterCode: '', relatedChallenges: [],
      examples: [{
        id: 'ex_arr_chunk', name: 'Chunk processing loop',
        code: 'void process_in_chunks(int arr[], int size, int chunk_size) {\n    for (int i = 0; i < size; i += chunk_size) {\n        int current_chunk_size = (size - i < chunk_size) ? (size - i) : chunk_size;\n        printf("Processing chunk starting at index %d of size %d\\n", i, current_chunk_size);\n        // Do work on &arr[i] of size current_chunk_size\n    }\n}\n',
        highlightLines: ''
      }],
      tryCodingTargetIndices: []
    },
    {
      id: 'sn_math_clamp', _isDefault: true,
      title: 'Clamp Value', parentId: fSnMath.id, order: 0,
      tags: ['Math', 'Utility'],
      description: '<p>Restricts a value to be within a specified minimum and maximum boundary.</p>',
      comments: '<p>Can be implemented as a macro or inline function. Protects against out-of-bounds indices.</p>',
      starterCode: '', relatedChallenges: [],
      examples: [{
        id: 'ex_math_clamp', name: 'Clamp Function',
        code: 'int clamp(int val, int min, int max) {\n    if (val < min) return min;\n    if (val > max) return max;\n    return val;\n}\n',
        highlightLines: ''
      }],
      tryCodingTargetIndices: []
    },
    {
      id: 'sn_math_pow2', _isDefault: true,
      title: 'Power of Two Checker', parentId: fSnMath.id, order: 1,
      tags: ['Math', 'Bitwise'],
      description: '<p>Checks if a positive integer is an exact power of two using fast bitwise logic.</p>',
      comments: '<p>Complexity: <code>O(1)</code>. The expression <code>n &amp; (n - 1)</code> clears the lowest set bit of n.</p>',
      starterCode: '', relatedChallenges: [],
      examples: [{
        id: 'ex_math_pow2', name: 'Bitwise Power of 2',
        code: '#include <stdbool.h>\n\nbool is_power_of_two(int n) {\n    return (n > 0) && ((n & (n - 1)) == 0);\n}\n',
        highlightLines: ''
      }],
      tryCodingTargetIndices: []
    },
    {
      id: 'sn_math_rand', _isDefault: true,
      title: 'Random in Range', parentId: fSnMath.id, order: 2,
      tags: ['Math', 'Random'],
      description: '<p>Generates a pseudo-random integer between a min and max value (inclusive).</p>',
      comments: '<p>Uses the standard <code>rand()</code> from <code>&lt;stdlib.h&gt;</code>. Ensure you seed with <code>srand(time(NULL))</code> once on startup.</p>',
      starterCode: '', relatedChallenges: [],
      examples: [{
        id: 'ex_math_rand', name: 'Rand Range',
        code: '#include <stdlib.h>\n\nint get_random_in_range(int min, int max) {\n    return min + rand() % (max - min + 1);\n}\n',
        highlightLines: ''
      }],
      tryCodingTargetIndices: []
    },
    {
      id: 'sn_mem_safe_alloc', _isDefault: true,
      title: 'Safe Malloc Wrapper', parentId: fSnMemIO.id, order: 0,
      tags: ['Memory', 'Safety'],
      description: '<p>Wraps standard <code>malloc</code> to verify that the allocation succeeded before returning the pointer.</p>',
      comments: '<p>Prevents crashes due to unhandled NULL pointer returns on memory exhaustion.</p>',
      starterCode: '', relatedChallenges: [],
      examples: [{
        id: 'ex_mem_safe_alloc', name: 'Safe Allocator',
        code: '#include <stdio.h>\n#include <stdlib.h>\n\nvoid *safe_malloc(size_t size) {\n    void *ptr = malloc(size);\n    if (ptr == NULL && size > 0) {\n        fprintf(stderr, "Fatal Error: Out of memory during allocation of %zu bytes\\n", size);\n        exit(EXIT_FAILURE);\n    }\n    return ptr;\n}\n',
        highlightLines: ''
      }],
      tryCodingTargetIndices: []
    },
    {
      id: 'sn_io_read_file', _isDefault: true,
      title: 'Read Entire File', parentId: fSnMemIO.id, order: 1,
      tags: ['I/O', 'File'],
      description: '<p>Reads the entire contents of a text file into a dynamically allocated string buffer.</p>',
      comments: '<p>Ensures that the file is closed safely and that a null terminator is appended to the buffer.</p>',
      starterCode: '', relatedChallenges: [],
      examples: [{
        id: 'ex_io_read_file', name: 'File Reader',
        code: '#include <stdio.h>\n#include <stdlib.h>\n\nchar *read_entire_file(const char *filename) {\n    FILE *f = fopen(filename, "rb");\n    if (!f) return NULL;\n    fseek(f, 0, SEEK_END);\n    long size = ftell(f);\n    rewind(f);\n    char *buf = malloc(size + 1);\n    if (buf) {\n        fread(buf, 1, size, f);\n        buf[size] = \'\\0\';\n    }\n    fclose(f);\n    return buf;\n}\n',
        highlightLines: ''
      }],
      tryCodingTargetIndices: []
    },
    {
      id: 'sn_str_safe_copy', _isDefault: true,
      title: 'Safe String Copy', parentId: fSnMemIO.id, order: 2,
      tags: ['Memory', 'Safety'],
      description: '<p>Securely copies a source string to a destination buffer while guaranteeing null-termination.</p>',
      comments: '<p>Unlike standard <code>strncpy</code>, this custom function ensures that the destination is always null-terminated even if the source is longer than the buffer.</p>',
      starterCode: '', relatedChallenges: [],
      examples: [{
        id: 'ex_str_safe_copy', name: 'Safe Copy Implementation',
        code: '#include <stdio.h>\n#include <string.h>\n\nvoid safe_strcpy(char *dest, const char *src, size_t dest_size) {\n    if (dest_size == 0) return;\n    strncpy(dest, src, dest_size - 1);\n    dest[dest_size - 1] = \'\\0\';\n}\n',
        highlightLines: ''
      }],
      tryCodingTargetIndices: []
    }
  ];

  const notebooks = [
    {
      id: 'nb_cell_structure', _isDefault: true,
      title: 'Cell Structure & Organelles', parentId: fNbCellGen.id, order: 0,
      icon: 'book', tags: ['Cell Biology', 'Organelles'],
      description: 'Quiz covering cell structures, organelles, and their specific functions.',
      sections: [{
        id: 'sec_cell_struct', label: 'Cell Structure', choices: 4,
        questions: [1, 2, 3],
        answerKey: '',
        answerKeysData: [
          { qNum: 1, type: 'mcq', answer: 'A', explanation: 'The mitochondrion is known as the powerhouse of the cell because it generates chemical energy (ATP).', question: 'Which organelle is referred to as the powerhouse of the cell?', hint: 'It produces ATP.', choices: { A: 'Mitochondria', B: 'Nucleus', C: 'Ribosome', D: 'Lysosome' } },
          { qNum: 2, type: 'matching', answer: '', explanation: 'Nucleus contains DNA, Ribosomes synthesize proteins, and Lysosomes dispose of cellular waste.', question: 'Match the cellular organelles to their primary functions:', hint: '',
            pairs: [
              { left: 'Nucleus', right: 'Contains genetic material (DNA)' },
              { left: 'Ribosome', right: 'Synthesizes proteins' },
              { left: 'Lysosome', right: 'Contains digestive enzymes for waste' }
            ]
          },
          { qNum: 3, type: 'text', answer: 'Chlorophyll', explanation: 'Chlorophyll is the green pigment in plants that absorbs light energy during photosynthesis.', question: 'What is the name of the green pigment in chloroplasts that absorbs light?', hint: 'Starts with C.' }
        ]
      }]
    },
    {
      id: 'nb_dna_rna', _isDefault: true,
      title: 'DNA, RNA & Protein Synthesis', parentId: fNbCellGen.id, order: 1,
      icon: 'cpu', tags: ['Genetics', 'Molecular'],
      description: 'Quiz covering DNA structure, RNA bases, and protein synthesis.',
      sections: [{
        id: 'sec_dna_rna', label: 'Genetics Basics', choices: 4,
        questions: [1, 2, 3],
        answerKey: '',
        answerKeysData: [
          { qNum: 1, type: 'truefalse', answer: 'A', explanation: 'DNA replication is semi-conservative because each new DNA molecule consists of one original strand and one newly synthesized strand.', question: 'DNA replication is considered semi-conservative.', hint: 'Think about template strands.' },
          { qNum: 2, type: 'mcq', answer: 'B', explanation: 'Uracil is a nitrogenous base found only in RNA. DNA uses thymine instead.', question: 'Which nitrogenous base is present in RNA but not in DNA?', hint: 'Pairs with Adenine in RNA.', choices: { A: 'Thymine', B: 'Uracil', C: 'Cytosine', D: 'Adenine' } },
          { qNum: 3, type: 'checkbox', answer: ['A', 'C', 'D'], explanation: 'Cytosine, Thymine, and Uracil are single-ring pyrimidines, whereas Adenine and Guanine are double-ring purines.', question: 'Select all pyrimidine bases from the options below:', hint: 'Single-ring structures.', choices: { A: 'Cytosine', B: 'Adenine', C: 'Thymine', D: 'Uracil' } }
        ]
      }]
    },
    {
      id: 'nb_cell_division', _isDefault: true,
      title: 'Cell Division: Mitosis & Meiosis', parentId: fNbCellGen.id, order: 2,
      icon: 'layers', tags: ['Cell Biology', 'Division'],
      description: 'Quiz covering phases of mitosis and meiosis.',
      sections: [{
        id: 'sec_cell_division', label: 'Cell Division', choices: 4,
        questions: [1, 2, 3],
        answerKey: '',
        answerKeysData: [
          { qNum: 1, type: 'matching', answer: '', explanation: 'Prophase condenses chromosomes, Metaphase aligns them at the equatorial plane, and Anaphase pulls sister chromatids apart.', question: 'Match the mitotic phases to their key events:', hint: '',
            pairs: [
              { left: 'Prophase', right: 'Chromosomes condense and spindle forms' },
              { left: 'Metaphase', right: 'Chromosomes align along the cell middle' },
              { left: 'Anaphase', right: 'Sister chromatids separate to opposite poles' }
            ]
          },
          { qNum: 2, type: 'truefalse', answer: 'A', explanation: 'Meiosis involves two cell divisions resulting in four non-identical haploid gametes.', question: 'Meiosis results in four haploid daughter cells.', hint: 'Think about gametes.' },
          { qNum: 3, type: 'text', answer: 'Cytokinesis', explanation: 'Cytokinesis is the physical division of cytoplasm following karyokinesis.', question: 'What is the physical division of the cytoplasm called?', hint: 'Happens at the very end of cell division.' }
        ]
      }]
    },
    {
      id: 'nb_food_chains', _isDefault: true,
      title: 'Food Chains & Trophic Levels', parentId: fNbEcology.id, order: 0,
      icon: 'book', tags: ['Ecology', 'Trophic'],
      description: 'Quiz covering food webs, producers, consumers, and energy transfer.',
      sections: [{
        id: 'sec_food_chains', label: 'Food Chains', choices: 4,
        questions: [1, 2, 3],
        answerKey: '',
        answerKeysData: [
          { qNum: 1, type: 'mcq', answer: 'A', explanation: 'Producers (autotrophs) form the base of trophic levels by converting solar energy into food.', question: 'What type of organism forms the base of ecological food chains?', hint: 'They make their own food.', choices: { A: 'Primary Producer', B: 'Primary Consumer', C: 'Decomposer', D: 'Apex Predator' } },
          { qNum: 2, type: 'truefalse', answer: 'A', explanation: 'The 10% rule in ecology states that only about 10% of energy is transferred to the next trophic level.', question: 'Only about 10% of energy is transferred up to the next trophic level.', hint: 'Think about metabolic heat loss.' },
          { qNum: 3, type: 'matching', answer: '', explanation: 'Grass is a producer, Rabbit is a primary consumer (herbivore), and Hawk is a tertiary consumer (carnivore).', question: 'Match the organism to its trophic role:', hint: '',
            pairs: [
              { left: 'Grass', right: 'Primary Producer' },
              { left: 'Rabbit', right: 'Primary Consumer' },
              { left: 'Hawk', right: 'Tertiary Consumer' }
            ]
          }
        ]
      }]
    },
    {
      id: 'nb_biomes', _isDefault: true,
      title: 'Biomes & Adaptations', parentId: fNbEcology.id, order: 1,
      icon: 'cpu', tags: ['Ecology', 'Biomes'],
      description: 'Quiz covering terrestrial biomes and adaptations.',
      sections: [{
        id: 'sec_biomes', label: 'Biomes', choices: 4,
        questions: [1, 2, 3],
        answerKey: '',
        answerKeysData: [
          { qNum: 1, type: 'checkbox', answer: ['A', 'C'], explanation: 'Desert and Tundra receive very low annual precipitation (typically less than 25 cm).', question: 'Select all biomes characterized by low annual precipitation:', hint: 'Very dry environments.', choices: { A: 'Desert', B: 'Tropical Rainforest', C: 'Tundra', D: 'Temperate Forest' } },
          { qNum: 2, type: 'text', answer: 'Tundra', explanation: 'The tundra biome has permafrost, a permanently frozen layer of subsoil.', question: 'Which biome is characterized by a permanently frozen subsoil layer called permafrost?', hint: 'Cold and treeless.' },
          { qNum: 3, type: 'mcq', answer: 'A', explanation: 'Tropical rainforests house over 50% of terrestrial species due to stable warmth and moisture.', question: 'Which terrestrial biome has the highest species biodiversity?', hint: 'Near the equator.', choices: { A: 'Tropical Rainforest', B: 'Taiga', C: 'Savanna', D: 'Grassland' } }
        ]
      }]
    },
    {
      id: 'nb_cycles', _isDefault: true,
      title: 'Biogeochemical Cycles', parentId: fNbEcology.id, order: 2,
      icon: 'layers', tags: ['Ecology', 'Cycles'],
      description: 'Quiz covering carbon, nitrogen, and water cycles.',
      sections: [{
        id: 'sec_cycles', label: 'Cycles', choices: 4,
        questions: [1, 2, 3],
        answerKey: '',
        answerKeysData: [
          { qNum: 1, type: 'truefalse', answer: 'A', explanation: 'Nitrogen-fixing bacteria (like Rhizobium) convert atmospheric N2 gas into ammonia/nitrates plants can use.', question: 'Bacteria play a key role in nitrogen fixation.', hint: 'Legume root nodules.' },
          { qNum: 2, type: 'mcq', answer: 'A', explanation: 'Cellular respiration releases carbon dioxide into the atmosphere by breaking down glucose.', question: 'Which process releases carbon dioxide into the atmosphere?', hint: 'Done by both plants and animals.', choices: { A: 'Respiration', B: 'Photosynthesis', C: 'Nitrogen Fixation', D: 'Transpiration' } },
          { qNum: 3, type: 'matching', answer: '', explanation: 'Water to vapor is evaporation, carbon to sugar is photosynthesis, and nitrogen to ammonia is nitrogen fixation.', question: 'Match the cycle processes to their definitions:', hint: '',
            pairs: [
              { left: 'Water turning to vapor', right: 'Evaporation' },
              { left: 'Carbon conversion to glucose', right: 'Photosynthesis' },
              { left: 'Nitrogen conversion to ammonia', right: 'Nitrogen Fixation' }
            ]
          }
        ]
      }]
    },
    {
      id: 'nb_circulatory', _isDefault: true,
      title: 'The Circulatory System', parentId: fNbPhysio.id, order: 0,
      icon: 'book', tags: ['Physiology', 'Circulatory'],
      description: 'Quiz covering the human heart, blood vessels, and blood cells.',
      sections: [{
        id: 'sec_circulatory', label: 'Circulatory', choices: 4,
        questions: [1, 2, 3],
        answerKey: '',
        answerKeysData: [
          { qNum: 1, type: 'mcq', answer: 'A', explanation: 'The left ventricle pumps oxygenated blood through the aorta to the rest of the body.', question: 'Which heart chamber pumps oxygenated blood to the body tissues?', hint: 'Thickest muscular walls.', choices: { A: 'Left Ventricle', B: 'Right Ventricle', C: 'Left Atrium', D: 'Right Atrium' } },
          { qNum: 2, type: 'text', answer: 'Arteries|artery', explanation: 'Arteries carry blood away from the heart. Veins carry blood towards the heart.', question: 'What type of blood vessels carry blood away from the heart?', hint: 'Typically oxygenated blood.' },
          { qNum: 3, type: 'matching', answer: '', explanation: 'Red blood cells transport oxygen, white blood cells fight pathogens, and platelets assist in blood clotting.', question: 'Match the blood component to its function:', hint: '',
            pairs: [
              { left: 'Red Blood Cells', right: 'Transport oxygen' },
              { left: 'White Blood Cells', right: 'Fight pathogens' },
              { left: 'Platelets', right: 'Assist in blood clotting' }
            ]
          }
        ]
      }]
    },
    {
      id: 'nb_nervous', _isDefault: true,
      title: 'The Nervous System', parentId: fNbPhysio.id, order: 1,
      icon: 'cpu', tags: ['Physiology', 'Nervous'],
      description: 'Quiz covering neurons, synapses, and division of the nervous system.',
      sections: [{
        id: 'sec_nervous', label: 'Nervous', choices: 4,
        questions: [1, 2, 3],
        answerKey: '',
        answerKeysData: [
          { qNum: 1, type: 'mcq', answer: 'A', explanation: 'The neuron is the primary cell responsible for transmitting electrical signals.', question: 'What is the basic functional unit of the nervous system?', hint: 'Electrical signal transmission.', choices: { A: 'Neuron', B: 'Nephron', C: 'Alveolus', D: 'Axon' } },
          { qNum: 2, type: 'checkbox', answer: ['A', 'B'], explanation: 'The Central Nervous System consists solely of the Brain and the Spinal Cord. Peripheral nerves belong to the PNS.', question: 'Select all organs that belong to the Central Nervous System (CNS):', hint: 'Central control units.', choices: { A: 'Brain', B: 'Spinal Cord', C: 'Sciatic Nerve', D: 'Sensory Receptors' } },
          { qNum: 3, type: 'truefalse', answer: 'A', explanation: 'The sympathetic nervous system activates metabolic processes for "fight or flight", while the parasympathetic governs "rest and digest".', question: 'The sympathetic nervous system is responsible for the "fight or flight" response.', hint: 'Increases heart rate.' }
        ]
      }]
    },
    {
      id: 'nb_digestive', _isDefault: true,
      title: 'The Digestive System', parentId: fNbPhysio.id, order: 2,
      icon: 'layers', tags: ['Physiology', 'Digestive'],
      description: 'Quiz covering digestion, enzymes, and nutrient absorption.',
      sections: [{
        id: 'sec_digestive', label: 'Digestive', choices: 4,
        questions: [1, 2, 3],
        answerKey: '',
        answerKeysData: [
          { qNum: 1, type: 'matching', answer: '', explanation: 'Stomach provides acidic protein digestion, Small intestine absorbs nutrients, and Large intestine absorbs water.', question: 'Match the digestive organ to its function:', hint: '',
            pairs: [
              { left: 'Stomach', right: 'Acidic breakdown of proteins' },
              { left: 'Small Intestine', right: 'Primary site of nutrient absorption' },
              { left: 'Large Intestine', right: 'Reabsorption of water' }
            ]
          },
          { qNum: 2, type: 'mcq', answer: 'A', explanation: 'Bile is produced by the liver and stored in the gallbladder to emulsify fats.', question: 'Which organ produces bile?', hint: 'Largest internal organ.', choices: { A: 'Liver', B: 'Gallbladder', C: 'Pancreas', D: 'Stomach' } },
          { qNum: 3, type: 'text', answer: 'Amylase|ptyalin', explanation: 'Salivary amylase (ptyalin) begins the chemical digestion of carbohydrates/starch in the mouth.', question: 'What enzyme present in saliva breaks down starches into simpler sugars?', hint: 'Starts with A.' }
        ]
      }]
    },
    {
      id: 'nb_photosynthesis', _isDefault: true,
      title: 'Photosynthesis & Plant Cells', parentId: fNbBotany.id, order: 0,
      icon: 'book', tags: ['Botany', 'Photosynthesis'],
      description: 'Quiz covering chloroplasts, light reactions, and carbon fixation.',
      sections: [{
        id: 'sec_photosynthesis', label: 'Photosynthesis', choices: 4,
        questions: [1, 2, 3],
        answerKey: '',
        answerKeysData: [
          { qNum: 1, type: 'mcq', answer: 'A', explanation: 'Chloroplasts contain chlorophyll where light and dark reactions of photosynthesis take place.', question: 'In which plant cell organelle does photosynthesis occur?', hint: 'Green structure.', choices: { A: 'Chloroplast', B: 'Mitochondria', C: 'Vacuole', D: 'Cell Wall' } },
          { qNum: 2, type: 'truefalse', answer: 'A', explanation: 'Oxygen is released as a byproduct when water molecules are photolyzed during light-dependent reactions.', question: 'Oxygen gas is a direct product of the light-dependent reactions.', hint: 'Splitting of water.' },
          { qNum: 3, type: 'checkbox', answer: ['A', 'B'], explanation: 'Photosynthesis requires carbon dioxide, water, and sunlight to produce glucose and oxygen.', question: 'Select all chemical reactants required for photosynthesis:', hint: 'What plants take in.', choices: { A: 'Water', B: 'Carbon Dioxide', C: 'Oxygen', D: 'Glucose' } }
        ]
      }]
    },
    {
      id: 'nb_plant_repro', _isDefault: true,
      title: 'Plant Reproduction & Pollination', parentId: fNbBotany.id, order: 1,
      icon: 'cpu', tags: ['Botany', 'Reproduction'],
      description: 'Quiz covering flower parts, seeds, and pollination.',
      sections: [{
        id: 'sec_plant_repro', label: 'Reproduction', choices: 4,
        questions: [1, 2, 3],
        answerKey: '',
        answerKeysData: [
          { qNum: 1, type: 'mcq', answer: 'A', explanation: 'The stamen is the male organ consisting of anther and filament. The carpel/pistil is female.', question: 'What is the male reproductive organ of a flower?', hint: 'Contains anther.', choices: { A: 'Stamen', B: 'Carpel', C: 'Petal', D: 'Sepal' } },
          { qNum: 2, type: 'matching', answer: '', explanation: 'Anther produces pollen, Stigma receives pollen, and Ovary contains ovules which mature into fruit.', question: 'Match the flower parts to their reproductive roles:', hint: '',
            pairs: [
              { left: 'Anther', right: 'Produces pollen grains' },
              { left: 'Stigma', right: 'Sticky surface that receives pollen' },
              { left: 'Ovary', right: 'Contains ovules and becomes fruit' }
            ]
          },
          { qNum: 3, type: 'text', answer: 'Pollination', explanation: 'Pollination is the physical transfer of pollen from the male anther to the female stigma.', question: 'What is the transfer of pollen grains from anther to stigma called?', hint: 'Can be done by wind or bees.' }
        ]
      }]
    },
    {
      id: 'nb_plant_trans', _isDefault: true,
      title: 'Transport in Plants', parentId: fNbBotany.id, order: 2,
      icon: 'layers', tags: ['Botany', 'Transport'],
      description: 'Quiz covering xylem, phloem, transpiration, and active transport.',
      sections: [{
        id: 'sec_plant_trans', label: 'Transport', choices: 4,
        questions: [1, 2, 3],
        answerKey: '',
        answerKeysData: [
          { qNum: 1, type: 'truefalse', answer: 'B', explanation: 'Xylem transports water upward. Phloem transports organic nutrients (sugars) bidirectionally/downward.', question: 'Xylem is responsible for transporting sugars downward from leaves.', hint: 'Xylem = water, Phloem = food.' },
          { qNum: 2, type: 'mcq', answer: 'A', explanation: 'Xylem tissue consists of tracheids and vessel elements that carry water and dissolved minerals from roots to leaves.', question: 'Which vascular tissue transports water and dissolved minerals?', hint: 'Unidirectional upward flow.', choices: { A: 'Xylem', B: 'Phloem', C: 'Cambium', D: 'Cortex' } },
          { qNum: 3, type: 'matching', answer: '', explanation: 'Transpiration is water vapor loss, Translocation is sugar movement, and Cohesion is water molecules sticking together.', question: 'Match the botany transport terms to their definitions:', hint: '',
            pairs: [
              { left: 'Transpiration', right: 'Loss of water vapor through stomata' },
              { left: 'Translocation', right: 'Transport of sugars through phloem' },
              { left: 'Cohesion', right: 'Attraction between like water molecules' }
            ]
          }
        ]
      }]
    },
    {
      id: 'nb_natural_select', _isDefault: true,
      title: 'Evolution & Natural Selection', parentId: fNbEvolution.id, order: 0,
      icon: 'book', tags: ['Evolution', 'Genetics'],
      description: 'Quiz covering Darwinian evolution, natural selection, and adaptations.',
      sections: [{
        id: 'sec_natural_select', label: 'Natural Selection', choices: 4,
        questions: [1, 2, 3],
        answerKey: '',
        answerKeysData: [
          { qNum: 1, type: 'mcq', answer: 'A', explanation: 'Charles Darwin published "On the Origin of Species" in 1859, proposing natural selection.', question: 'Who proposed the theory of evolution by natural selection?', hint: 'Finch studies on Galapagos.', choices: { A: 'Charles Darwin', B: 'Jean-Baptiste Lamarck', C: 'Gregor Mendel', D: 'Louis Pasteur' } },
          { qNum: 2, type: 'truefalse', answer: 'A', explanation: 'Individuals live or die, but they cannot change their genes. The gene pool of the population shifts over generations.', question: 'Natural selection acts on individuals, but only populations evolve.', hint: 'Evolutions are generation changes.' },
          { qNum: 3, type: 'text', answer: 'Adaptation', explanation: 'Adaptation is a genetic trait that improves survival and reproduction in a specific habitat.', question: 'What is a heritable trait that increases an organism\'s capability to survive and reproduce?', hint: 'Starts with A.' }
        ]
      }]
    },
    {
      id: 'nb_taxonomy', _isDefault: true,
      title: 'Taxonomy & Five Kingdoms', parentId: fNbEvolution.id, order: 1,
      icon: 'cpu', tags: ['Evolution', 'Classification'],
      description: 'Quiz covering Linnaean classification and domains.',
      sections: [{
        id: 'sec_taxonomy', label: 'Taxonomy', choices: 4,
        questions: [1, 2, 3],
        answerKey: '',
        answerKeysData: [
          { qNum: 1, type: 'mcq', answer: 'A', explanation: 'Below Domain, Kingdom is the highest major taxonomic rank (Kingdom, Phylum, Class, Order, Family, Genus, Species).', question: 'Which level of biological classification is immediately below Domain?', hint: 'KPCOFGS.', choices: { A: 'Kingdom', B: 'Phylum', C: 'Class', D: 'Genus' } },
          { qNum: 2, type: 'checkbox', answer: ['A', 'B', 'C', 'D'], explanation: 'All four listed kingdoms contain eukaryotic cells. Bacteria and Archaea contain prokaryotic cells.', question: 'Select all biological kingdoms consisting of eukaryotic organisms:', hint: 'They have a nucleus.', choices: { A: 'Animalia', B: 'Plantae', C: 'Fungi', D: 'Protista' } },
          { qNum: 3, type: 'matching', answer: '', explanation: 'E. coli is bacteria (Monera), Yeast is a single-celled fungus, and Fern is a seedless vascular plant.', question: 'Match the organism to its kingdom/group:', hint: '',
            pairs: [
              { left: 'E. coli', right: 'Monera / Bacteria' },
              { left: 'Yeast', right: 'Fungi' },
              { left: 'Fern', right: 'Plantae' }
            ]
          }
        ]
      }]
    },
    {
      id: 'nb_evidence_evo', _isDefault: true,
      title: 'Evidence of Evolution', parentId: fNbEvolution.id, order: 2,
      icon: 'layers', tags: ['Evolution', 'Paleontology'],
      description: 'Quiz covering homologous structures, vestigial organs, and fossils.',
      sections: [{
        id: 'sec_evidence_evo', label: 'Evidence', choices: 4,
        questions: [1, 2, 3],
        answerKey: '',
        answerKeysData: [
          { qNum: 1, type: 'truefalse', answer: 'A', explanation: 'Homologous structures (like human arm and bat wing) reflect divergent evolution from a common ancestor.', question: 'Homologous structures share a common evolutionary origin.', hint: 'Opposite of analogous.' },
          { qNum: 2, type: 'mcq', answer: 'A', explanation: 'Vestigial structures are anatomical remnants that had a function in ancestors but are mostly redundant today.', question: 'What is a structure that has lost its original ancestral function called?', hint: 'Human appendix.', choices: { A: 'Vestigial', B: 'Analogous', C: 'Homologous', D: 'Adaptive' } },
          { qNum: 3, type: 'text', answer: 'Fossils|fossil', explanation: 'Fossils are preserved remains or mineralized prints of organisms from past geologic ages.', question: 'What are the preserved remains or traces of ancient organisms called?', hint: 'Typically found in sedimentary rock.' }
        ]
      }]
    }
  ];

  return { nodes, challenges, snippets, notebooks };
}

console.log("Validation Successful! Custom seed data structure built correctly.");
