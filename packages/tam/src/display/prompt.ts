import * as readline from 'readline'

export async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(`${message} [y/N] `, answer => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

export async function conflictChoice(
  destPath: string
): Promise<'keep' | 'overwrite' | 'skip'> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(
      `  Conflict in ${destPath}\n  [k]eep yours / [o]verwrite / [s]kip  `,
      answer => {
        rl.close()
        if (answer === 'o') resolve('overwrite')
        else if (answer === 's') resolve('skip')
        else resolve('keep')
      }
    )
  })
}
