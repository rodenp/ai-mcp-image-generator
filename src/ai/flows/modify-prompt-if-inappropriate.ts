'use server';

/**
 * @fileOverview Modifies a given prompt if it violates content usage policy.
 *
 * - modifyPromptIfInappropriate - A function that modifies the prompt if necessary.
 * - ModifyPromptIfInappropriateInput - The input type for the modifyPromptIfInappropriate function.
 * - ModifyPromptIfInappropriateOutput - The return type for the modifyPromptIfInappropriate function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ModifyPromptIfInappropriateInputSchema = z.object({
  prompt: z.string().describe('The original prompt provided by the user.'),
});
export type ModifyPromptIfInappropriateInput = z.infer<typeof ModifyPromptIfInappropriateInputSchema>;

const ModifyPromptIfInappropriateOutputSchema = z.object({
  modifiedPrompt: z.string().describe('The modified prompt, which conforms to content usage policy.'),
  isModified: z.boolean().describe('Indicates whether the prompt was modified or not.'),
});
export type ModifyPromptIfInappropriateOutput = z.infer<typeof ModifyPromptIfInappropriateOutputSchema>;

export async function modifyPromptIfInappropriate(input: ModifyPromptIfInappropriateInput): Promise<ModifyPromptIfInappropriateOutput> {
  return modifyPromptIfInappropriateFlow(input);
}

const prompt = ai.definePrompt({
  name: 'modifyPromptIfInappropriatePrompt',
  input: {schema: ModifyPromptIfInappropriateInputSchema},
  output: {schema: ModifyPromptIfInappropriateOutputSchema},
  prompt: `You are an AI assistant designed to evaluate a user-provided prompt for image generation and modify it if it violates content usage policies.

  Content Usage Policy: The generated images must be safe, appropriate for all audiences, and not contain any harmful, unethical, or illegal content.  This includes but is not limited to: hate speech, violence, sexually explicit material, or promotion of illegal activities.

  Evaluate the following prompt:
  Original Prompt: {{{prompt}}}

  1.  If the prompt is appropriate and aligns with the content usage policy, return the original prompt in the "modifiedPrompt" field and set "isModified" to false.
  2.  If the prompt violates the content usage policy, modify the prompt to conform to the policy while preserving the user's intent as much as possible. Explain the changes made. Return the modified prompt in the "modifiedPrompt" field and set "isModified" to true.

  Output should be in JSON format.
  `,
});

const modifyPromptIfInappropriateFlow = ai.defineFlow(
  {
    name: 'modifyPromptIfInappropriateFlow',
    inputSchema: ModifyPromptIfInappropriateInputSchema,
    outputSchema: ModifyPromptIfInappropriateOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
