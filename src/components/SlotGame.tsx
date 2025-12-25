import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { COLORS } from '../constants/theme';

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🍉', '🍓'];
const SYMBOL_VALUES: { [key: string]: number } = {
  '🍒': 5,
  '🍋': 10,
  '🍊': 15,
  '🍇': 20,
  '🍉': 25,
  '🍓': 30,
};
const GRID_SIZE = 5;
const SPIN_DURATION = 2000;
const WIN_PERCENTAGE = 0; // 0-100: Chance of getting a winning combination

interface SlotGameProps {
  onWin?: (amount: number) => void;
}

const SlotGame: React.FC<SlotGameProps> = ({ onWin }) => {
  const [credits, setCredits] = useState(200);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [winningCells, setWinningCells] = useState<Set<string>>(new Set());

  // Initialize 5x5 grid
  const initializeGrid = () => {
    const grid: string[][] = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      grid[i] = [];
      for (let j = 0; j < GRID_SIZE; j++) {
        grid[i][j] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      }
    }
    return grid;
  };

  // Generate a winning grid with guaranteed matches
  const generateWinningGrid = () => {
    const grid = initializeGrid();
    
    // Force a winning combination (3 in a row horizontally)
    const winRow = Math.floor(Math.random() * GRID_SIZE);
    const startCol = Math.floor(Math.random() * (GRID_SIZE - 2)); // Ensure space for 3
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    
    for (let i = 0; i < 3; i++) {
      grid[winRow][startCol + i] = symbol;
    }
    
    return grid;
  };

  // Generate a non-winning grid
  const generateNonWinningGrid = () => {
    let grid: string[][] = [];
    let attempts = 0;
    const maxAttempts = 100;
    
    do {
      grid = initializeGrid();
      attempts++;
      
      // If we've tried too many times, just return the grid
      if (attempts >= maxAttempts) break;
      
    } while (checkWin(grid).won);
    
    return grid;
  };

  // Generate grid based on win percentage
  const generateGridWithChance = () => {
    const random = Math.random() * 100;
    
    if (random < WIN_PERCENTAGE) {
      return generateWinningGrid();
    } else {
      return generateNonWinningGrid();
    }
  };

  const [grid, setGrid] = useState<string[][]>(initializeGrid());

  // Create animation values for each column (not individual cells)
  const animValues = useRef(
    Array.from({ length: GRID_SIZE }, () => new Animated.Value(0))
  ).current;

  const getRandomSymbol = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

  const checkWin = (newGrid: string[][]): { won: boolean; amount: number; matches: Set<string> } => {
    let totalWin = 0;
    const matchedCells = new Set<string>();

    // Check horizontal lines
    for (let i = 0; i < GRID_SIZE; i++) {
      let j = 0;
      while (j < GRID_SIZE) {
        const symbol = newGrid[i][j];
        let count = 1;
        for (let k = j + 1; k < GRID_SIZE; k++) {
          if (newGrid[i][k] === symbol) count++;
          else break;
        }
        if (count >= 3) {
          const baseValue = SYMBOL_VALUES[symbol] || 5;
          totalWin += baseValue * count; // Sum of all matching symbols
          for (let k = j; k < j + count; k++) {
            matchedCells.add(`${i}-${k}`);
          }
        }
        j += count; // Skip past the matched sequence
      }
    }

    // Check vertical lines
    for (let j = 0; j < GRID_SIZE; j++) {
      let i = 0;
      while (i < GRID_SIZE) {
        const symbol = newGrid[i][j];
        let count = 1;
        for (let k = i + 1; k < GRID_SIZE; k++) {
          if (newGrid[k][j] === symbol) count++;
          else break;
        }
        if (count >= 3) {
          const baseValue = SYMBOL_VALUES[symbol] || 5;
          totalWin += baseValue * count; // Sum of all matching symbols
          for (let k = i; k < i + count; k++) {
            matchedCells.add(`${k}-${j}`);
          }
        }
        i += count; // Skip past the matched sequence
      }
    }

    // Check diagonals (top-left to bottom-right)
    for (let i = 0; i <= GRID_SIZE - 3; i++) {
      for (let j = 0; j <= GRID_SIZE - 3; j++) {
        const symbol = newGrid[i][j];
        let count = 1;
        for (let k = 1; i + k < GRID_SIZE && j + k < GRID_SIZE; k++) {
          if (newGrid[i + k][j + k] === symbol) count++;
          else break;
        }
        if (count >= 3) {
          const baseValue = (SYMBOL_VALUES[symbol] || 5) * 1.5; // 1.5x for diagonal
          totalWin += Math.floor(baseValue * count); // Sum of all matching symbols
          for (let k = 0; k < count; k++) {
            matchedCells.add(`${i + k}-${j + k}`);
          }
        }
      }
    }

    // Check diagonals (top-right to bottom-left)
    for (let i = 0; i <= GRID_SIZE - 3; i++) {
      for (let j = GRID_SIZE - 1; j >= 2; j--) {
        const symbol = newGrid[i][j];
        let count = 1;
        for (let k = 1; i + k < GRID_SIZE && j - k >= 0; k++) {
          if (newGrid[i + k][j - k] === symbol) count++;
          else break;
        }
        if (count >= 3) {
          const baseValue = (SYMBOL_VALUES[symbol] || 5) * 1.5; // 1.5x for diagonal
          totalWin += Math.floor(baseValue * count); // Sum of all matching symbols
          for (let k = 0; k < count; k++) {
            matchedCells.add(`${i + k}-${j - k}`);
          }
        }
      }
    }

    return { won: totalWin > 0, amount: totalWin, matches: matchedCells };
  };

  const spin = () => {
    if (isSpinning || credits < 20) return;

    setIsSpinning(true);
    setResult(null);
    setWinningCells(new Set());
    setCredits(prev => prev - 20);

    // Generate final grid BEFORE animation starts and set it immediately
    const finalGrid = initializeGrid();
    setGrid(finalGrid);

    // Reset all column animations
    animValues.forEach(anim => anim.setValue(0));

    // Create staggered animations for each column
    const animations = [];
    for (let j = 0; j < GRID_SIZE; j++) {
      animations.push(
        Animated.timing(animValues[j], {
          toValue: 1,
          duration: SPIN_DURATION - (j * 100), // Each column stops earlier
          delay: j * 200, // Stagger start time
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        })
      );
    }

    Animated.parallel(animations).start(() => {
      // Check for wins (grid is already set)
      const winResult = checkWin(finalGrid);

      if (winResult.won) {
        setCredits(prev => prev + winResult.amount);
        setResult(`🎉 MEGA WIN! +${winResult.amount} credits`);
        setWinningCells(winResult.matches);
        onWin?.(winResult.amount);
      } else {
        setResult('No matches - Try again!');
      }

      setIsSpinning(false);
    });
  };

  const resetCredits = () => {
    setCredits(200);
    setResult(null);
    setWinningCells(new Set());
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="grid" size={24} color={COLORS.primary} />
        <Text style={styles.title}>5x5 Slot Grid</Text>
      </View>

      <View style={styles.creditsContainer}>
        <Text style={styles.creditsLabel}>Credits</Text>
        <Text style={styles.creditsValue}>{credits}</Text>
      </View>

      <View style={styles.gridContainer}>
        {/* Render by columns instead of rows */}
        <View style={styles.columnsWrapper}>
          {Array.from({ length: GRID_SIZE }).map((_, colIndex) => {
            const translateY = animValues[colIndex] ? animValues[colIndex].interpolate({
              inputRange: [0, 1],
              outputRange: [0, -(GRID_SIZE * 60 * 3)], // Spin through multiple cycles
            }) : new Animated.Value(0);

            return (
              <View key={colIndex} style={styles.column}>
                <Animated.View style={{ transform: [{ translateY }] }}>
                  {/* Show multiple sets of symbols for spinning effect */}
                  {Array.from({ length: GRID_SIZE * 5 }).map((_, symbolIndex) => {
                    const rowIndex = symbolIndex % GRID_SIZE;
                    const isWinning = !isSpinning && winningCells.has(`${rowIndex}-${colIndex}`);
                    const symbol = grid[rowIndex] && grid[rowIndex][colIndex] 
                      ? grid[rowIndex][colIndex] 
                      : getRandomSymbol();

                    return (
                      <View
                        key={`${colIndex}-${symbolIndex}`}
                        style={[styles.cell, isWinning && styles.cellWinning]}
                      >
                        <Text style={styles.symbol}>{symbol}</Text>
                      </View>
                    );
                  })}
                </Animated.View>
              </View>
            );
          })}
        </View>
      </View>

      {result && (
        <View style={[
          styles.resultContainer,
          { backgroundColor: result.includes('WIN') ? COLORS.success + '20' : COLORS.gray100 }
        ]}>
          <Text style={[
            styles.resultText,
            { color: result.includes('WIN') ? COLORS.success : COLORS.gray700 }
          ]}>
            {result}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.spinButton,
          (isSpinning || credits < 20) && styles.spinButtonDisabled
        ]}
        onPress={spin}
        disabled={isSpinning || credits < 20}
      >
        <MaterialCommunityIcons
          name={isSpinning ? "loading" : "play"}
          size={24}
          color={COLORS.white}
        />
        <Text style={styles.spinButtonText}>
          {isSpinning ? 'Spinning...' : 'SPIN (20 credits)'}
        </Text>
      </TouchableOpacity>

      {credits < 20 && (
        <TouchableOpacity style={styles.resetButton} onPress={resetCredits}>
          <Text style={styles.resetButtonText}>Reset Credits</Text>
        </TouchableOpacity>
      )}

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>💰 Win Combinations & Values:</Text>
        <Text style={styles.infoText}>• 🍒 Cherry = 5 credits</Text>
        <Text style={styles.infoText}>• 🍋 Lemon = 10 credits</Text>
        <Text style={styles.infoText}>• 🍊 Orange = 15 credits</Text>
        <Text style={styles.infoText}>• 🍇 Grape = 20 credits</Text>
        <Text style={styles.infoText}>• 🍉 Watermelon = 25 credits</Text>
        <Text style={styles.infoText}>• 🍓 Strawberry = 30 credits</Text>
        <Text style={styles.infoText}>• 3+ in a row/column = base value × matches</Text>
        <Text style={styles.infoText}>• Diagonal matches = 1.5x multiplier!</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginLeft: 8,
  },
  creditsContainer: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  creditsLabel: {
    fontSize: 11,
    color: COLORS.gray600,
    marginBottom: 2,
  },
  creditsValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  gridContainer: {
    alignItems: 'center',
    marginBottom: 16,
    height: GRID_SIZE * 60,
    overflow: 'hidden',
  },
  columnsWrapper: {
    flexDirection: 'row',
    gap: 4,
  },
  column: {
    height: GRID_SIZE * 60,
    overflow: 'hidden',
  },
  cell: {
    width: 56,
    height: 56,
    backgroundColor: COLORS.gray50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.gray300,
    marginBottom: 4,
  },
  cellWinning: {
    backgroundColor: COLORS.success + '20',
    borderColor: COLORS.success,
    borderWidth: 3,
  },
  symbol: {
    fontSize: 32,
  },
  resultContainer: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  resultText: {
    fontSize: 15,
    fontWeight: '600',
  },
  spinButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  spinButtonDisabled: {
    backgroundColor: COLORS.gray400,
    opacity: 0.6,
  },
  spinButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  resetButton: {
    backgroundColor: COLORS.gray100,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  resetButtonText: {
    color: COLORS.gray700,
    fontSize: 13,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: COLORS.gray50,
    borderRadius: 8,
    padding: 10,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray800,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 11,
    color: COLORS.gray600,
    marginBottom: 2,
  },
});

export default SlotGame;
