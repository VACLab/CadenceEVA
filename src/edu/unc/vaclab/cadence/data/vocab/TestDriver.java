package edu.unc.vaclab.cadence.data.vocab;

public class TestDriver {
    public static void main(String args[]) {
        // Deserialize a vocabulary file for inspection.
        Vocabulary _vocab = new Vocabulary(null, null, null, "web/cfg/ICD10_chapters.csv");

        _vocab.deserializeFromFile("/Volumes/Gotz_David_IRB15-2043/Run2/DATA/data_dm/vocab.ser");
        System.out.println("Done!");
    }
}
