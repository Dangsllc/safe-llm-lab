// Export utilities for data download and reporting

import { TestSession, PromptTemplate, SafetyThresholds } from "./storage/types";
import { storageManager } from "./storage/storage-manager";

export interface ExportData {
  testSessions: TestSession[];
  promptTemplates: PromptTemplate[];
  safetyThresholds: SafetyThresholds;
  metadata: {
    exportDate: Date;
    version: string;
    totalSessions: number;
    totalTemplates: number;
  };
}

// Download blob utility
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Export to JSON
export const exportToJSON = async (filename?: string): Promise<void> => {
  try {
    const data: ExportData = {
      testSessions: await storageManager.getTestSessions(),
      promptTemplates: await storageManager.getPromptTemplates(),
      safetyThresholds: await storageManager.getSafetyThresholds(),
      metadata: {
        exportDate: new Date(),
        version: '1.0',
        totalSessions: (await storageManager.getTestSessions()).length,
        totalTemplates: (await storageManager.getPromptTemplates()).length
      }
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const exportFilename = filename || `llm-safety-export-${new Date().toISOString().split('T')[0]}.json`;
    
    downloadBlob(blob, exportFilename);
  } catch (error) {
    console.error('Export to JSON failed:', error);
    throw new Error('Failed to export data to JSON');
  }
};

// Export test sessions to CSV
export const exportSessionsToCSV = async (filename?: string): Promise<void> => {
  try {
    const sessions = await storageManager.getTestSessions();
    
    if (sessions.length === 0) {
      throw new Error('No test sessions to export');
    }

    const headers = [
      'Session ID',
      'Model Name',
      'Prompt Template',
      'Prompt',
      'Response',
      'Classification',
      'Risk Level',
      'Notes',
      'Timestamp'
    ];

    const csvRows = [
      headers.join(','),
      ...sessions.map(session => [
        `"${session.id}"`,
        `"${session.modelName}"`,
        `"${session.promptTemplate.replace(/"/g, '""')}"`,
        `"${session.prompt.replace(/"/g, '""')}"`,
        `"${session.response.replace(/"/g, '""')}"`,
        `"${session.classification}"`,
        `"${session.riskLevel}"`,
        `"${session.notes.replace(/"/g, '""')}"`,
        `"${session.timestamp}"`
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const exportFilename = filename || `test-sessions-${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadBlob(blob, exportFilename);
  } catch (error) {
    console.error('Export to CSV failed:', error);
    throw error;
  }
};

// Export templates to CSV
export const exportTemplatesToCSV = async (filename?: string): Promise<void> => {
  try {
    const templates = await storageManager.getPromptTemplates();
    
    if (templates.length === 0) {
      throw new Error('No templates to export');
    }

    const headers = [
      'ID',
      'Title',
      'Content',
      'Risk Level',
      'Category',
      'Variables',
      'Shots',
      'Created At',
      'Updated At'
    ];

    const csvRows = [
      headers.join(','),
      ...templates.map(template => [
        `"${template.id}"`,
        `"${template.title.replace(/"/g, '""')}"`,
        `"${template.content.replace(/"/g, '""')}"`,
        `"${template.riskLevel}"`,
        `"${template.category}"`,
        `"${template.variables.join('; ')}"`,
        `"${template.shots || 1}"`,
        `"${template.createdAt}"`,
        `"${template.updatedAt}"`
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const exportFilename = filename || `prompt-templates-${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadBlob(blob, exportFilename);
  } catch (error) {
    console.error('Export templates to CSV failed:', error);
    throw error;
  }
};

// Generate statistical report
export const generateStatisticalReport = async (): Promise<void> => {
  try {
    const sessions = await storageManager.getTestSessions();
    const templates = await storageManager.getPromptTemplates();
    
    const report = generateMarkdownReport(sessions, templates);
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8;' });
    const filename = `statistical-report-${new Date().toISOString().split('T')[0]}.md`;
    
    downloadBlob(blob, filename);
  } catch (error) {
    console.error('Statistical report generation failed:', error);
    throw error;
  }
};

// Generate research summary report
export const generateResearchSummary = async (): Promise<void> => {
  try {
    const sessions = await storageManager.getTestSessions();
    const templates = await storageManager.getPromptTemplates();
    
    const summary = generateExecutiveSummary(sessions, templates);
    const blob = new Blob([summary], { type: 'text/markdown;charset=utf-8;' });
    const filename = `research-summary-${new Date().toISOString().split('T')[0]}.md`;
    
    downloadBlob(blob, filename);
  } catch (error) {
    console.error('Research summary generation failed:', error);
    throw error;
  }
};

// Generate detailed markdown report
const generateMarkdownReport = (sessions: TestSession[], templates: PromptTemplate[]): string => {
  const now = new Date();
  
  // Calculate statistics
  const totalTests = sessions.length;
  const modelStats = sessions.reduce((acc, session) => {
    acc[session.modelName] = (acc[session.modelName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const riskStats = sessions.reduce((acc, session) => {
    acc[session.riskLevel] = (acc[session.riskLevel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const classificationStats = sessions.reduce((acc, session) => {
    acc[session.classification] = (acc[session.classification] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return `# LLM Safety Research Statistical Report

Generated: ${now.toLocaleString()}

## Overview

- **Total Test Sessions**: ${totalTests}
- **Total Templates**: ${templates.length}
- **Analysis Period**: ${totalTests > 0 ? `${new Date(Math.min(...sessions.map(s => new Date(s.timestamp).getTime()))).toLocaleDateString()} - ${new Date(Math.max(...sessions.map(s => new Date(s.timestamp).getTime()))).toLocaleDateString()}` : 'No data'}

## Model Performance

${Object.entries(modelStats).map(([model, count]) => 
  `- **${model}**: ${count} tests (${((count/totalTests) * 100).toFixed(1)}%)`
).join('\n') || 'No model data available'}

## Risk Level Distribution

${Object.entries(riskStats).map(([risk, count]) => 
  `- **${risk.charAt(0).toUpperCase() + risk.slice(1)} Risk**: ${count} tests (${((count/totalTests) * 100).toFixed(1)}%)`
).join('\n') || 'No risk data available'}

## Response Classifications

${Object.entries(classificationStats).map(([classification, count]) => 
  `- **${classification}**: ${count} responses (${((count/totalTests) * 100).toFixed(1)}%)`
).join('\n') || 'No classification data available'}

## Template Categories

${templates.reduce((acc, template) => {
  acc[template.category] = (acc[template.category] || 0) + 1;
  return acc;
}, {} as Record<string, number>) && Object.entries(templates.reduce((acc, template) => {
  acc[template.category] = (acc[template.category] || 0) + 1;
  return acc;
}, {} as Record<string, number>)).map(([category, count]) => 
  `- **${category}**: ${count} templates`
).join('\n') || 'No template data available'}

## Methodology

This report analyzes LLM safety testing data collected through systematic prompt evaluation. Each test session includes:

- Standardized prompt templates
- Model response capture
- Manual safety classification
- Risk level assessment
- Researcher notes and observations

## Data Quality Notes

- All responses have been manually classified by researchers
- Risk levels assigned based on content analysis
- Timestamps recorded in local timezone
- Data exported in UTF-8 encoding

---
*Report generated by LLM Safety Research Platform v1.0*
`;
};

// Generate executive summary
const generateExecutiveSummary = (sessions: TestSession[], templates: PromptTemplate[]): string => {
  const totalTests = sessions.length;
  const highRiskTests = sessions.filter(s => s.riskLevel === 'high').length;
  const safeResponses = sessions.filter(s => s.classification === '0.0' || s.classification === '0.0-hard').length;
  
  return `# LLM Safety Research - Executive Summary

**Date**: ${new Date().toLocaleDateString()}
**Research Period**: ${totalTests > 0 ? `${new Date(Math.min(...sessions.map(s => new Date(s.timestamp).getTime()))).toLocaleDateString()} - ${new Date(Math.max(...sessions.map(s => new Date(s.timestamp).getTime()))).toLocaleDateString()}` : 'No data collected'}

## Key Findings

### Testing Overview
- **Total Tests Conducted**: ${totalTests}
- **High-Risk Scenarios**: ${highRiskTests} (${totalTests > 0 ? ((highRiskTests/totalTests) * 100).toFixed(1) : 0}%)
- **Safe Responses**: ${safeResponses} (${totalTests > 0 ? ((safeResponses/totalTests) * 100).toFixed(1) : 0}%)

### Safety Performance
${totalTests === 0 ? 'No testing data available yet.' : `
The research evaluated ${totalTests} interactions across multiple risk scenarios. Key safety metrics:

- **Refusal Rate**: ${totalTests > 0 ? ((safeResponses/totalTests) * 100).toFixed(1) : 0}% of requests were appropriately declined
- **Risk Assessment**: ${((highRiskTests/totalTests) * 100).toFixed(1)}% of tests involved high-risk scenarios
- **Template Coverage**: ${templates.length} standardized prompts used across ${new Set(sessions.map(s => s.modelName)).size} models
`}

### Methodology
This research follows systematic LLM safety evaluation protocols:

1. **Standardized Prompts**: Using ${templates.length} validated prompt templates
2. **Multi-Risk Assessment**: Covering low, medium, and high-risk scenarios
3. **Manual Classification**: Expert review of all model responses
4. **Reproducible Testing**: Documented procedures and consistent evaluation criteria

### Recommendations

${totalTests === 0 ? `
**Begin Systematic Testing**: No data collected yet. Recommend starting with:
- Baseline safety evaluations using provided templates
- Cross-model comparison studies
- Risk-level progression testing
` : `
Based on ${totalTests} test sessions:

1. **Continue Monitoring**: Maintain systematic evaluation protocols
2. **Expand Coverage**: Consider additional risk scenarios if needed
3. **Regular Review**: Periodic assessment of safety thresholds
4. **Documentation**: Ensure all findings are properly recorded
`}

### Technical Notes
- Data stored locally with cloud backup capability
- All responses manually classified using standardized criteria
- Export capabilities available for external analysis
- Compliance with research data management protocols

---
**Prepared by**: LLM Safety Research Platform  
**Version**: 1.0  
**Contact**: Research Team  
`;
};
