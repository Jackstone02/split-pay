import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { COLORS } from '../constants/theme';
import { AuthContext } from '../context/AuthContext';

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🍉', '🍓'];
const SYMBOL_VALUES: { [key: string]: number } = {
  '🍒': 5,
  '🍋': 10,
  '🍊': 15,
  '🍇': 20,
  '🍉': 25,
  '🍓': 30,
};
const WILD_SYMBOL = '⭐';
const WILD_APPEARANCE_RATE = 1; // 30% chance of wild appearing per spin (0 or 1 max) - configurable
const WILD_MULTIPLIER = 10; // Bonus multiplier when wild is involved
const GRID_SIZE = 5;
const SPIN_DURATION = 2000;
const WIN_PERCENTAGE = 30; // 0-100: Chance of getting a winning combination
const STORAGE_KEY = '@amot_slot_credits';
const LAST_CLAIM_KEY = '@amot_slot_last_claim';
const DAILY_BONUS = 100;
const BONUS_THRESHOLD = 50; // Credits must be at or below this to claim bonus

interface SlotGameProps {
  onWin?: (amount: number) => void;
}

// Helper function to get win tier info
const getWinTierInfo = (amount: number) => {
  if (amount >= 300) {
    return {
      message: `💎 SUPER WIN! +${amount} credits`,
      backgroundColor: '#9333EA', // Purple
      pulseScale: 1.3,
      pulseDuration: 400,
      pulseCount: 4,
    };
  } else if (amount >= 101) {
    return {
      message: `🎉 MEGA WIN! +${amount} credits`,
      backgroundColor: '#F59E0B', // Orange
      pulseScale: 1.2,
      pulseDuration: 500,
      pulseCount: 3,
    };
  } else if (amount >= 51) {
    return {
      message: `🌟 BIG WIN! +${amount} credits`,
      backgroundColor: '#3B82F6', // Blue
      pulseScale: 1.15,
      pulseDuration: 600,
      pulseCount: 2,
    };
  } else {
    return {
      message: `✨ NICE WIN! +${amount} credits`,
      backgroundColor: '#10B981', // Green
      pulseScale: 1.1,
      pulseDuration: 700,
      pulseCount: 1,
    };
  }
};

// Helper function to get win message based on amount (for backward compatibility)
const getWinMessage = (amount: number): string => {
  return getWinTierInfo(amount).message;
};

const SlotGame: React.FC<SlotGameProps> = ({ onWin }) => {
  const authContext = useContext(AuthContext);
  const [credits, setCredits] = useState(200);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [winningCells, setWinningCells] = useState<Set<string>>(new Set());
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);
  const [dailyBonusMessage, setDailyBonusMessage] = useState<string | null>(null);
  const [winAmount, setWinAmount] = useState<number>(0);

  // Animation values for win message
  const winScaleAnim = useRef(new Animated.Value(0)).current;
  const winOpacityAnim = useRef(new Animated.Value(0)).current;
  const winRotateAnim = useRef(new Animated.Value(0)).current;

  // Animation for spinning icon
  const spinIconAnim = useRef(new Animated.Value(0)).current;

  // Load credits from storage on mount and check for daily bonus
  useEffect(() => {
    const loadCreditsAndCheckBonus = async () => {
      try {
        if (authContext?.user?.id) {
          const storageKey = `${STORAGE_KEY}_${authContext.user.id}`;
          const lastClaimKey = `${LAST_CLAIM_KEY}_${authContext.user.id}`;

          // Load credits
          const savedCredits = await AsyncStorage.getItem(storageKey);
          let currentCredits = savedCredits !== null ? parseInt(savedCredits, 10) : 200;

          // Check for daily bonus
          const lastClaimTime = await AsyncStorage.getItem(lastClaimKey);
          const now = new Date().getTime();
          const oneDayInMs = 24 * 60 * 60 * 1000;

          let canClaimBonus = false;
          if (lastClaimTime) {
            const lastClaim = parseInt(lastClaimTime, 10);
            const timeSinceLastClaim = now - lastClaim;
            canClaimBonus = timeSinceLastClaim >= oneDayInMs;
          } else {
            // First time, allow claiming
            canClaimBonus = true;
          }

          // Apply daily bonus if eligible
          if (canClaimBonus && currentCredits <= BONUS_THRESHOLD) {
            currentCredits += DAILY_BONUS;
            await AsyncStorage.setItem(storageKey, currentCredits.toString());
            await AsyncStorage.setItem(lastClaimKey, now.toString());
            setDailyBonusMessage(`🎁 Daily Bonus! +${DAILY_BONUS} credits`);
            // Clear the message after 5 seconds
            setTimeout(() => setDailyBonusMessage(null), 5000);
          }

          setCredits(currentCredits);
        }
      } catch (error) {
        console.error('Error loading credits:', error);
      } finally {
        setIsLoadingCredits(false);
      }
    };
    loadCreditsAndCheckBonus();
  }, [authContext?.user?.id]);

  // Save credits to storage whenever they change
  useEffect(() => {
    const saveCredits = async () => {
      try {
        if (authContext?.user?.id && !isLoadingCredits) {
          const storageKey = `${STORAGE_KEY}_${authContext.user.id}`;
          await AsyncStorage.setItem(storageKey, credits.toString());
        }
      } catch (error) {
        console.error('Error saving credits:', error);
      }
    };
    saveCredits();
  }, [credits, authContext?.user?.id, isLoadingCredits]);

  // Animate the spinning icon
  useEffect(() => {
    if (isSpinning) {
      spinIconAnim.setValue(0);
      Animated.loop(
        Animated.timing(spinIconAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinIconAnim.stopAnimation();
      spinIconAnim.setValue(0);
    }
  }, [isSpinning, spinIconAnim]);

  // Function to animate win message based on tier
  const animateWinMessage = (amount: number) => {
    const tierInfo = getWinTierInfo(amount);
    setWinAmount(amount);

    // Reset animations
    winScaleAnim.setValue(0);
    winOpacityAnim.setValue(0);
    winRotateAnim.setValue(0);

    // Fade in
    Animated.timing(winOpacityAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Create pulse sequence
    const pulseAnimations = [];
    for (let i = 0; i < tierInfo.pulseCount; i++) {
      pulseAnimations.push(
        Animated.sequence([
          Animated.timing(winScaleAnim, {
            toValue: tierInfo.pulseScale,
            duration: tierInfo.pulseDuration / 2,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(winScaleAnim, {
            toValue: 1,
            duration: tierInfo.pulseDuration / 2,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    }

    // Add shake/wobble effect for MEGA and SUPER wins
    if (amount >= 101) {
      const wobbleAnimations = [];
      const wobbleAngles = [0, -3, 3, -3, 3, -2, 2, 0];

      wobbleAngles.forEach(angle => {
        wobbleAnimations.push(
          Animated.timing(winRotateAnim, {
            toValue: angle,
            duration: 100,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        );
      });

      Animated.parallel([
        Animated.sequence(pulseAnimations),
        Animated.sequence(wobbleAnimations),
      ]).start();
    } else {
      Animated.sequence(pulseAnimations).start();
    }
  };

  // Initialize 5x5 grid
  const initializeGrid = () => {
    const grid: string[][] = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      grid[i] = [];
      for (let j = 0; j < GRID_SIZE; j++) {
        grid[i][j] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      }
    }

    // Randomly decide if we place ONE wild symbol (0 or 1 max per grid)
    if (Math.random() < WILD_APPEARANCE_RATE) {
      const randomRow = Math.floor(Math.random() * GRID_SIZE);
      const randomCol = Math.floor(Math.random() * GRID_SIZE);
      grid[randomRow][randomCol] = WILD_SYMBOL;
    }

    return grid;
  };

  // Generate a winning grid with guaranteed matches
  const generateWinningGrid = () => {
    let grid: string[][] = [];
    let hasWinningSequence = false;
    const winType = Math.random() < 0.7 ? 'horizontal' : 'diagonal'; // 70% horizontal, 30% diagonal
    const diagonalType = Math.random() < 0.5 ? 'down-right' : 'up-right'; // 50/50 for diagonal direction

    // Keep generating until we get a clean winning grid
    while (!hasWinningSequence) {
      grid = initializeGrid();
      const matchLength = Math.floor(Math.random() * 3) + 3; // 3, 4, or 5 matches
      const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

      if (winType === 'horizontal') {
        // Horizontal win from left column
        const winRow = Math.floor(Math.random() * GRID_SIZE);
        for (let i = 0; i < matchLength; i++) {
          grid[winRow][i] = symbol;
        }

        let sequenceValid = true;
        for (let i = 0; i < matchLength; i++) {
          if (grid[winRow][i] !== symbol) {
            sequenceValid = false;
            break;
          }
        }
        hasWinningSequence = sequenceValid;
      } else if (diagonalType === 'down-right') {
        // Diagonal win (top-left to bottom-right) starting from column 0
        const startRow = Math.floor(Math.random() * (GRID_SIZE - matchLength + 1));
        const startCol = 0; // MUST start from column 0
        for (let i = 0; i < matchLength; i++) {
          grid[startRow + i][startCol + i] = symbol;
        }

        let sequenceValid = true;
        for (let i = 0; i < matchLength; i++) {
          if (grid[startRow + i][startCol + i] !== symbol) {
            sequenceValid = false;
            break;
          }
        }
        hasWinningSequence = sequenceValid;
      } else {
        // Diagonal win (bottom-left to top-right) starting from column 0
        const startRow = Math.floor(Math.random() * (GRID_SIZE - matchLength + 1)) + (matchLength - 1);
        const startCol = 0; // MUST start from column 0
        for (let i = 0; i < matchLength; i++) {
          grid[startRow - i][startCol + i] = symbol;
        }

        let sequenceValid = true;
        for (let i = 0; i < matchLength; i++) {
          if (grid[startRow - i][startCol + i] !== symbol) {
            sequenceValid = false;
            break;
          }
        }
        hasWinningSequence = sequenceValid;
      }
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

    // Check horizontal lines (only from left column - column 0)
    for (let i = 0; i < GRID_SIZE; i++) {
      const symbol = newGrid[i][0];

      // Skip if starting with wild (treat as non-matching chain start)
      if (symbol === WILD_SYMBOL) continue;

      let count = 1;
      let hasWild = false;

      // Count consecutive matches (including wilds which act as wildcards)
      for (let k = 1; k < GRID_SIZE; k++) {
        if (newGrid[i][k] === symbol || newGrid[i][k] === WILD_SYMBOL) {
          count++;
          if (newGrid[i][k] === WILD_SYMBOL) hasWild = true;
        } else {
          break;
        }
      }

      if (count >= 3) {
        const baseValue = SYMBOL_VALUES[symbol] || 5;
        // Apply multipliers: 5-match gets 2x, wild gets 1.5x (can stack)
        let multiplier = count === 5 ? 2 : 1;
        if (hasWild) multiplier *= WILD_MULTIPLIER;

        totalWin += baseValue * count * multiplier;
        for (let k = 0; k < count; k++) {
          matchedCells.add(`${i}-${k}`);
        }
      }
    }

    // Check diagonals (top-left to bottom-right) starting from LEFT COLUMN with 1.5x multiplier
    for (let i = 0; i <= GRID_SIZE - 3; i++) {
      const j = 0; // MUST start from column 0 (leftmost)
      const symbol = newGrid[i][j];

      // Skip if starting with wild (treat as non-matching chain start)
      if (symbol === WILD_SYMBOL) continue;

      let count = 1;
      let hasWild = false;

      for (let k = 1; i + k < GRID_SIZE && j + k < GRID_SIZE; k++) {
        if (newGrid[i + k][j + k] === symbol || newGrid[i + k][j + k] === WILD_SYMBOL) {
          count++;
          if (newGrid[i + k][j + k] === WILD_SYMBOL) hasWild = true;
        } else {
          break;
        }
      }

      if (count >= 3) {
        const baseValue = (SYMBOL_VALUES[symbol] || 5) * 1.5; // 1.5x for diagonal
        let multiplier = hasWild ? WILD_MULTIPLIER : 1; // Wild bonus
        totalWin += Math.floor(baseValue * count * multiplier);
        for (let k = 0; k < count; k++) {
          matchedCells.add(`${i + k}-${j + k}`);
        }
      }
    }

    // Check diagonals (bottom-left to top-right) starting from LEFT COLUMN with 1.5x multiplier
    for (let i = GRID_SIZE - 1; i >= 2; i--) {
      const j = 0; // MUST start from column 0 (leftmost)
      const symbol = newGrid[i][j];

      // Skip if starting with wild (treat as non-matching chain start)
      if (symbol === WILD_SYMBOL) continue;

      let count = 1;
      let hasWild = false;

      for (let k = 1; i - k >= 0 && j + k < GRID_SIZE; k++) {
        if (newGrid[i - k][j + k] === symbol || newGrid[i - k][j + k] === WILD_SYMBOL) {
          count++;
          if (newGrid[i - k][j + k] === WILD_SYMBOL) hasWild = true;
        } else {
          break;
        }
      }

      if (count >= 3) {
        const baseValue = (SYMBOL_VALUES[symbol] || 5) * 1.5; // 1.5x for diagonal
        let multiplier = hasWild ? WILD_MULTIPLIER : 1; // Wild bonus
        totalWin += Math.floor(baseValue * count * multiplier);
        for (let k = 0; k < count; k++) {
          matchedCells.add(`${i - k}-${j + k}`);
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
    setWinAmount(0);
    setCredits(prev => prev - 20);

    // Reset win animations
    winScaleAnim.setValue(1);
    winOpacityAnim.setValue(1);
    winRotateAnim.setValue(0);

    // Generate final grid and set it immediately
    const finalGrid = generateGridWithChance();
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
      // Animation complete - check for wins
      const winResult = checkWin(finalGrid);

      if (winResult.won) {
        setCredits(prev => prev + winResult.amount);
        setResult(getWinMessage(winResult.amount));
        setWinningCells(winResult.matches);
        animateWinMessage(winResult.amount);
        onWin?.(winResult.amount);
      } else {
        setResult('No matches - Try again!');
        setWinAmount(0);
        winScaleAnim.setValue(1);
        winOpacityAnim.setValue(1);
        winRotateAnim.setValue(0);
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
      <View style={styles.creditsContainer}>
        <Text style={styles.creditsLabel}>Credits</Text>
        <Text style={styles.creditsValue}>
          {isLoadingCredits ? '...' : credits}
        </Text>
      </View>

      {dailyBonusMessage && (
        <View style={[
          styles.resultContainer,
          { backgroundColor: COLORS.primary + '20' }
        ]}>
          <Text style={[
            styles.resultText,
            { color: COLORS.primary }
          ]}>
            {dailyBonusMessage}
          </Text>
        </View>
      )}

      {result && (
        <Animated.View style={[
          styles.resultContainer,
          result.includes('WIN') ? {
            backgroundColor: getWinTierInfo(winAmount).backgroundColor,
            transform: [
              { scale: winScaleAnim },
              {
                rotate: winRotateAnim.interpolate({
                  inputRange: [-10, 10],
                  outputRange: ['-10deg', '10deg']
                })
              }
            ],
            opacity: winOpacityAnim,
          } : {
            backgroundColor: COLORS.gray100,
          }
        ]}>
          <Text style={[
            styles.resultText,
            { color: result.includes('WIN') ? COLORS.white : COLORS.gray700 }
          ]}>
            {result}
          </Text>
        </Animated.View>
      )}

      <View style={styles.gridContainer}>
        {/* Render by columns for spinning animation */}
        <View style={styles.columnsWrapper}>
          {Array.from({ length: GRID_SIZE }).map((_, colIndex) => {
            const translateY = animValues[colIndex].interpolate({
              inputRange: [0, 1],
              outputRange: [-(GRID_SIZE * 60 * 3), 0], // Spin from top to bottom
            });

            return (
              <View key={colIndex} style={styles.column}>
                <Animated.View style={{ transform: [{ translateY }] }}>
                  {/* Show multiple sets of symbols for spinning effect */}
                  {Array.from({ length: GRID_SIZE * 5 }).map((_, symbolIndex) => {
                    const rowIndex = symbolIndex % GRID_SIZE;
                    const isWinning = !isSpinning && winningCells.has(`${rowIndex}-${colIndex}`);
                    // Always use grid state - no random generation during render
                    const symbol = grid[rowIndex]?.[colIndex] || SYMBOLS[0];

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

      <TouchableOpacity
        style={[
          styles.spinButton,
          (isSpinning || credits < 20 || isLoadingCredits) && styles.spinButtonDisabled
        ]}
        onPress={spin}
        disabled={isSpinning || credits < 20 || isLoadingCredits}
      >
        <Animated.View
          style={{
            transform: [
              {
                rotate: spinIconAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                }),
              },
            ],
          }}
        >
          <MaterialCommunityIcons
            name={isSpinning ? "loading" : "play"}
            size={24}
            color={COLORS.white}
          />
        </Animated.View>
        <Text style={styles.spinButtonText}>
          {isLoadingCredits ? 'Loading...' : isSpinning ? 'Spinning...' : 'SPIN (20 credits)'}
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
        <Text style={styles.infoText}>• ⭐ Wild = acts as wildcard</Text>
        <Text style={styles.infoText}>• 3+ matching symbols = base value × matches</Text>
        <Text style={styles.infoText}>• Horizontal (left-to-right): base × matches</Text>
        <Text style={styles.infoText}>• Diagonal matches: base × 1.5 × matches</Text>
        <Text style={styles.infoText}>• 5-match row: base × 2 × matches (BONUS!)</Text>
        <Text style={styles.infoText}>• Wild in match: × 10 multiplier (stacks!)</Text>
        <Text style={styles.infoText}> </Text>
        <Text style={styles.infoTitle}>🎯 Wild Symbol (⭐):</Text>
        <Text style={styles.infoText}>• Appears once or not at all per spin (~30% chance)</Text>
        <Text style={styles.infoText}>• Matches ANY symbol in a chain</Text>
        <Text style={styles.infoText}>• Example: Lemon + Wild + Lemon = Win!</Text>
        <Text style={styles.infoText}>• Adds 10x bonus to your win (multipliers stack!)</Text>
        <Text style={styles.infoText}> </Text>
        <Text style={styles.infoTitle}>🏆 Win Tiers:</Text>
        <Text style={styles.infoText}>• ✨ Nice Win: 20-50 credits</Text>
        <Text style={styles.infoText}>• 🌟 Big Win: 51-100 credits</Text>
        <Text style={styles.infoText}>• �� Mega Win: 101-299 credits</Text>
        <Text style={styles.infoText}>• 💎 Super Win: 300+ credits</Text>
        <Text style={styles.infoText}> </Text>
        <Text style={styles.infoTitle}>🎁 Daily Bonus:</Text>
        <Text style={styles.infoText}>• Get 100 free credits per day</Text>
        <Text style={styles.infoText}>• Only when you have 50 or fewer credits</Text>
        <Text style={styles.infoText}>• Automatically claimed on login!</Text>
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
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  resultText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.5,
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
