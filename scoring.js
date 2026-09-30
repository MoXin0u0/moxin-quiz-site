function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value.map(item => normalizeText(item)).sort()
    : [];
}

export function checkAnswer(question, userAnswer) {
  switch (question.type) {
    case 'single-choice':
      return normalizeText(userAnswer) === normalizeText(question.answer?.[0]);

    case 'multiple-choice': {
      const expected = normalizeArray(question.answer);
      const actual = normalizeArray(userAnswer);
      return expected.length === actual.length && expected.every((item, index) => item === actual[index]);
    }

    case 'true-false':
      return Boolean(userAnswer) === Boolean(question.answer?.[0]);

    case 'fill-in': {
      const actual = normalizeText(userAnswer);
      const answers = Array.isArray(question.answer) ? question.answer : [];
      const caseSensitive = question.caseSensitive === true;
      return answers.some(item => {
        const expected = normalizeText(item);
        return caseSensitive
          ? actual === expected
          : actual.toLocaleLowerCase() === expected.toLocaleLowerCase();
      });
    }

    default:
      return false;
  }
}
