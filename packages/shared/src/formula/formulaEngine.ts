/**
 * 公式计算引擎
 * 支持基础数学运算和常用函数
 */

export interface CellReference {
  row: number;
  col: number;
  absolute?: boolean;
}

export interface FormulaResult {
  value: number | string | boolean | null;
  error?: string;
}

export class FormulaEngine {
  private cells: Record<string, any>;
  
  constructor(cells: Record<string, any> = {}) {
    this.cells = cells;
  }

  /**
   * 更新单元格数据
   */
  updateCells(cells: Record<string, any>) {
    this.cells = cells;
  }

  /**
   * 解析并计算公式
   */
  evaluate(formula: string): FormulaResult {
    try {
      // 移除开头的等号
      const cleanFormula = formula.startsWith('=') ? formula.slice(1) : formula;
      
      if (!cleanFormula.trim()) {
        return { value: null };
      }

      // 替换单元格引用
      const processedFormula = this.replaceCellReferences(cleanFormula);
      
      // 处理函数调用
      const result = this.evaluateExpression(processedFormula);
      
      return { value: result };
    } catch (error) {
      return { 
        value: null, 
        error: error instanceof Error ? error.message : 'Formula error' 
      };
    }
  }

  /**
   * 替换单元格引用为实际值
   */
  private replaceCellReferences(formula: string): string {
    // 匹配单元格引用 (A1, $A$1, A$1, $A1)
    const cellRefPattern = /(\$?[A-Z]+\$?\d+)/g;
    
    return formula.replace(cellRefPattern, (match) => {
      const cellRef = this.parseCellReference(match);
      const cellKey = `${cellRef.row}:${cellRef.col}`;
      const cellValue = this.cells[cellKey];
      
      // 如果是数字，直接返回；如果是字符串数字，转换为数字；否则返回0
      if (typeof cellValue === 'number') {
        return cellValue.toString();
      } else if (typeof cellValue === 'string' && !isNaN(Number(cellValue))) {
        return cellValue;
      } else {
        return '0';
      }
    });
  }

  /**
   * 解析单元格引用
   */
  private parseCellReference(ref: string): CellReference {
    const match = ref.match(/^(\$?)([A-Z]+)(\$?)(\d+)$/);
    if (!match) {
      throw new Error(`Invalid cell reference: ${ref}`);
    }

    const [, colAbsolute, colStr, rowAbsolute, rowStr] = match;
    
    // 将列字母转换为数字 (A=0, B=1, ...)
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 65 + 1);
    }
    col -= 1; // 转换为0-based索引

    const row = parseInt(rowStr) - 1; // 转换为0-based索引

    return {
      row,
      col,
      absolute: !!(colAbsolute || rowAbsolute)
    };
  }

  /**
   * 计算表达式
   */
  private evaluateExpression(expression: string): number | string | boolean {
    // 处理函数调用
    expression = this.processFunctions(expression);
    
    // 简单的数学表达式计算
    try {
      // 安全的表达式评估（仅允许数字、运算符、括号）
      const safeExpression = expression.replace(/[^0-9+\-*/().\s]/g, '');
      if (safeExpression !== expression) {
        throw new Error('Invalid characters in expression');
      }
      
      // 使用Function构造器安全计算
      const result = new Function(`"use strict"; return (${safeExpression})`)();
      return result;
    } catch (error) {
      throw new Error('Invalid expression');
    }
  }

  /**
   * 处理函数调用
   */
  private processFunctions(expression: string): string {
    // 支持的函数列表
    const functions = {
      SUM: this.sumFunction.bind(this),
      AVERAGE: this.averageFunction.bind(this),
      COUNT: this.countFunction.bind(this),
      MAX: this.maxFunction.bind(this),
      MIN: this.minFunction.bind(this),
      IF: this.ifFunction.bind(this),
    };

    // 处理函数调用
    for (const [funcName, funcImpl] of Object.entries(functions)) {
      const pattern = new RegExp(`${funcName}\\(([^)]+)\\)`, 'gi');
      expression = expression.replace(pattern, (match, args) => {
        try {
          const result = funcImpl(args);
          return result.toString();
        } catch (error) {
          throw new Error(`Error in ${funcName}: ${error}`);
        }
      });
    }

    return expression;
  }

  /**
   * SUM函数实现
   */
  private sumFunction(args: string): number {
    const values = this.parseArguments(args);
    return values.reduce((sum, val) => sum + (this.toNumber(val) || 0), 0);
  }

  /**
   * AVERAGE函数实现
   */
  private averageFunction(args: string): number {
    const values = this.parseArguments(args);
    const numbers = values.map(val => this.toNumber(val)).filter(n => n !== null);
    
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, val) => sum + val, 0) / numbers.length;
  }

  /**
   * COUNT函数实现
   */
  private countFunction(args: string): number {
    const values = this.parseArguments(args);
    return values.filter(val => this.toNumber(val) !== null).length;
  }

  /**
   * MAX函数实现
   */
  private maxFunction(args: string): number {
    const values = this.parseArguments(args);
    const numbers = values.map(val => this.toNumber(val)).filter(n => n !== null);
    
    if (numbers.length === 0) return 0;
    return Math.max(...numbers);
  }

  /**
   * MIN函数实现
   */
  private minFunction(args: string): number {
    const values = this.parseArguments(args);
    const numbers = values.map(val => this.toNumber(val)).filter(n => n !== null);
    
    if (numbers.length === 0) return 0;
    return Math.min(...numbers);
  }

  /**
   * IF函数实现
   */
  private ifFunction(args: string): string | number {
    const parts = this.parseArguments(args);
    if (parts.length < 2) {
      throw new Error('IF function requires at least 2 arguments');
    }

    const condition = parts[0];
    const trueValue = parts[1];
    const falseValue = parts[2] || '';

    // 简单的条件判断
    const conditionResult = this.evaluateCondition(condition);
    return conditionResult ? trueValue : falseValue;
  }

  /**
   * 解析函数参数
   */
  private parseArguments(args: string): string[] {
    // 简单的参数解析，支持逗号分隔
    const arguments_list: string[] = [];
    let current = '';
    let parenCount = 0;

    for (let i = 0; i < args.length; i++) {
      const char = args[i];
      
      if (char === '(') {
        parenCount++;
      } else if (char === ')') {
        parenCount--;
      } else if (char === ',' && parenCount === 0) {
        arguments_list.push(current.trim());
        current = '';
        continue;
      }
      
      current += char;
    }
    
    if (current.trim()) {
      arguments_list.push(current.trim());
    }

    return arguments_list;
  }

  /**
   * 转换为数字
   */
  private toNumber(value: string): number | null {
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    }
    return typeof value === 'number' ? value : null;
  }

  /**
   * 计算条件表达式
   */
  private evaluateCondition(condition: string): boolean {
    // 简单的条件判断实现
    const operators = ['>=', '<=', '>', '<', '=', '!='];
    
    for (const op of operators) {
      if (condition.includes(op)) {
        const parts = condition.split(op);
        if (parts.length === 2) {
          const left = this.toNumber(parts[0].trim()) || 0;
          const right = this.toNumber(parts[1].trim()) || 0;
          
          switch (op) {
            case '>=': return left >= right;
            case '<=': return left <= right;
            case '>': return left > right;
            case '<': return left < right;
            case '=': return left === right;
            case '!=': return left !== right;
          }
        }
      }
    }
    
    // 如果没有操作符，判断是否为真值
    const num = this.toNumber(condition);
    return num !== null && num !== 0;
  }

  /**
   * 获取列名 (A, B, C...)
   */
  static getColumnName(col: number): string {
    let result = '';
    let temp = col;
    do {
      result = String.fromCharCode(65 + (temp % 26)) + result;
      temp = Math.floor(temp / 26) - 1;
    } while (temp >= 0);
    return result;
  }

  /**
   * 获取单元格地址 (A1, B2...)
   */
  static getCellAddress(row: number, col: number): string {
    return `${FormulaEngine.getColumnName(col)}${row + 1}`;
  }
}

export default FormulaEngine;


