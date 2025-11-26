/**
 * Robust SQL parser that handles function definitions with semicolons
 */
function parseSQL(sql) {
  const statements = [];
  let currentStatement = '';
  let inFunction = false;
  let inString = false;
  let stringChar = '';
  let inDollarQuote = false;
  let dollarTag = '';
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];
    
    // Handle string literals
    if (!inDollarQuote && (char === "'" || char === '"') && !inString) {
      inString = true;
      stringChar = char;
      currentStatement += char;
    } else if (inString && char === stringChar && sql[i - 1] !== '\\') {
      inString = false;
      currentStatement += char;
    }
    // Handle dollar-quoted strings ($$ or $tag$)
    else if (!inString && char === '$' && !inDollarQuote) {
      if (nextChar === '$') {
        inDollarQuote = true;
        dollarTag = '';
        currentStatement += char;
      } else if (/[a-zA-Z_]/.test(nextChar)) {
        // Start of tagged dollar quote $tag$
        inDollarQuote = true;
        dollarTag = '';
        let j = i + 1;
        while (j < sql.length && /[a-zA-Z_0-9]/.test(sql[j])) {
          dollarTag += sql[j];
          j++;
        }
        currentStatement += char;
      } else {
        currentStatement += char;
      }
    }
    // End dollar-quoted string
    else if (inDollarQuote && char === '$') {
      if (dollarTag === '' && nextChar === '$') {
        inDollarQuote = false;
        currentStatement += '$$';
        i++; // Skip next $
      } else if (dollarTag !== '' && sql.substr(i + 1, dollarTag.length) === dollarTag && sql[i + 1 + dollarTag.length] === '$') {
        inDollarQuote = false;
        currentStatement += '$' + dollarTag + '$';
        i += dollarTag.length + 1; // Skip tag and ending $
      } else {
        currentStatement += char;
      }
    }
    // Regular character
    else {
      currentStatement += char;
      
      // End of statement (semicolon not in string/function)
      if (char === ';' && !inString && !inDollarQuote) {
        const trimmed = currentStatement.trim();
        if (trimmed && trimmed !== ';') {
          statements.push(trimmed);
        }
        currentStatement = '';
      }
    }
  }
  
  // Add final statement if any
  const finalTrimmed = currentStatement.trim();
  if (finalTrimmed && finalTrimmed !== ';') {
    statements.push(finalTrimmed);
  }
  
  return statements;
}

module.exports = { parseSQL };